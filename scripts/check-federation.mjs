import {loadSigningIdentity,signValue} from '../lib/signing-identity.mjs';
import {fingerprint,verifySignedPackage} from '../lib/sharing-auth.ts';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startPeerSync,pullPeer} from '../lib/peer-sync.mjs';
import {restorePortfolio,emptyContext} from '../lib/locations.ts';
import {makeBackup,parseBackup} from '../lib/backup.ts';
import {createSharedGroup,stageContributions,makeSharedPackage,previewSharedMerge,addSharedReview,reviewSummary} from '../lib/sharing.ts';
const note=(id,name)=>({id,name,lat:40,lng:-105,category:'Observation',source:'Synthetic field visit',detail:name+' detail'});
const make=(name)=>createSharedGroup(restorePortfolio({...emptyContext(),schemaVersion:13,routes:[],notes:[note(name,name+' private observation')]}),name+' private group',name);
let john=make('John'),sam=make('Sam'),tim=make('Tim');const groupId=john.sharing.groups[0].id;
john=stageContributions(john,groupId,['note:John']);const jr=john.sharing.groups[0].records[0],jid=jr.id,jrev=jr.revisions[0].id;
sam=previewSharedMerge(sam,makeSharedPackage(john,groupId,[jid]),'home').next;tim=previewSharedMerge(tim,makeSharedPackage(john,groupId,[jid]),'home').next;
sam=stageContributions(sam,groupId,['note:Sam']);tim=stageContributions(tim,groupId,['note:Tim']);
const sid=sam.sharing.groups.find(g=>g.id===groupId).records.find(r=>r.member.id===sam.sharing.member.id).id,tid=tim.sharing.groups.find(g=>g.id===groupId).records.find(r=>r.member.id===tim.sharing.member.id).id;
const root=path.resolve(process.cwd()),dirs=await Promise.all(['john','sam','tim'].map(n=>mkdtemp(path.join(root,'.local-storage-test-federation-'+n+'-'))));let services=[];
async function control(service,route,body){const r=await fetch(`http://127.0.0.1:${service.state().controlPort}${route}`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,value:await r.json()};}
async function command(service,route,body){if(route==='/grants'||route==='/preview'){const card=services.map(s=>s.state().identity).find(c=>c?.member.id===body.recipientId);body={...body,recipientIdentity:card,verifiedFingerprint:await fingerprint(card.publicKey)};}if(route==='/peers'){const invite=JSON.parse(body.invitation);body={...body,verifiedFingerprint:await fingerprint(invite.publisherIdentity.publicKey)};}const r=await control(service,route,body);assert.equal(r.status,200,JSON.stringify(r.value));if(r.value.package)await verifySignedPackage(r.value.package);return r.value;}
async function grant(service,recipient,ids){return (await command(service,'/grants',{groupId,label:'Synthetic recipient',recipientId:recipient.sharing.member.id,recordIds:ids})).invite;}
const review=(p,id,revisionId,comment)=>addSharedReview(p,groupId,id,{revisionId,status:'Confirmed',observedAt:'2026-10-09T12:00:00Z',comment});
try{
 const j=await startPeerSync({directory:dirs[0],port:0,controlPort:0,studyReader:async()=>john});services.push(j);
 const s=await startPeerSync({directory:dirs[1],port:0,controlPort:0,studyReader:async()=>sam});services.push(s);
 const t=await startPeerSync({directory:dirs[2],port:0,controlPort:0,studyReader:async()=>tim});services.push(t);
 const js=await grant(j,sam,[jid]),jt=await grant(j,tim,[jid]);sam=previewSharedMerge(sam,await s.pull(js),'home').next;tim=previewSharedMerge(tim,await t.pull(jt),'home').next;
 assert.equal((await control(t,'/peers',{label:'Wrong recipient',invitation:JSON.stringify(js)})).status,400);
 // Tim's new confirmation must never appear in John's existing invitation to Sam.
 tim=review(tim,jid,jrev,'Tim confidential review');sam=review(sam,jid,jrev,'Sam confidential review');
 const sj=await grant(s,john,[jid,sid]),tj=await grant(t,john,[jid,tid]);
 const sPeer=(await command(j,'/peers',{label:'Sam',invitation:JSON.stringify(sj)})).id,tPeer=(await command(j,'/peers',{label:'Tim',invitation:JSON.stringify(tj)})).id;
 await command(j,'/sync',{id:sPeer});await command(j,'/sync',{id:tPeer});
 john=previewSharedMerge(john,await j.pull(sj),'home',sPeer).next;john=previewSharedMerge(john,await j.pull(tj),'home',tPeer).next;
 const allIds=[jid,sid,tid];assert.equal(reviewSummary(john.sharing.groups[0].records[0],jrev).confirmed,2);
 const toSam=await s.pull(js),toTim=await t.pull(jt);
 assert(!JSON.stringify(toSam).includes('Tim confidential'));assert(!JSON.stringify(toTim).includes('Sam confidential'));
 assert.equal(reviewSummary(toSam.records[0],jrev).confirmed,1);assert.equal(reviewSummary(toTim.records[0],jrev).confirmed,1);
 const raw=makeSharedPackage(john,groupId,allIds);assert.deepEqual(raw.records.map(r=>r.id),[jid]);assert.equal(raw.records[0].reviews.length,0);
 const samRev=john.sharing.groups[0].records.find(r=>r.id===sid).revisions[0].id;john=review(john,sid,samRev,'John checked Sam observation');
 const returned=makeSharedPackage(john,groupId,allIds,sam.sharing.member.id);assert.deepEqual(returned.records.map(r=>r.id),[jid,sid]);assert(!JSON.stringify(returned).includes('Tim confidential'));assert.equal(returned.records[1].reviews[0].member.id,john.sharing.member.id);
 const preview=await command(j,'/preview',{groupId,recordIds:allIds,recipientId:sam.sharing.member.id});assert.equal(preview.excluded,1);assert(!JSON.stringify(preview.package).includes('Tim confidential'));
 assert.equal((await control(j,'/grants',{groupId,label:'Unsafe selection',recordIds:allIds,recipientId:sam.sharing.member.id})).status,400);
 const backToSam=await grant(j,sam,[jid,sid]);assert(!JSON.stringify(await s.pull(backToSam)).includes('Tim confidential'));
 // Legacy imported histories stay local; reimporting must not bless old unknown events.
 const legacy=structuredClone(john);legacy.schemaVersion=13;for(const g of legacy.sharing.groups)delete g.provenance;
 const migrated=restorePortfolio(legacy);assert.equal(migrated.schemaVersion,18);assert.equal(makeSharedPackage(migrated,groupId,allIds,sam.sharing.member.id).records.length,0);
 const retry=previewSharedMerge(migrated,returned,'home').next;assert.equal(makeSharedPackage(retry,groupId,allIds,sam.sharing.member.id).records.length,0);
 const backup=parseBackup(JSON.stringify(makeBackup(john,[]))).backup.study;assert.deepEqual(backup,john);
 assert(!JSON.stringify(returned).includes('provenance'));assert(!JSON.stringify(returned).includes(sPeer));
 // Invitation migration fails closed without losing settings.
 await j.close();services=services.filter(v=>v!==j);const configFile=path.join(dirs[0],'peer-sync.json'),config=JSON.parse(await readFile(configFile,'utf8'));
 for(const g of config.grants){delete g.policy;delete g.publisherId;delete g.recipientId;}await writeFile(configFile,JSON.stringify(config));
 const renewed=await startPeerSync({directory:dirs[0],port:0,controlPort:0,studyReader:async()=>john});services.push(renewed);assert(renewed.state().grants.every(g=>g.needsRenewal));
 const redirected={...js,endpoint:renewed.state().endpoint};delete redirected.signature;const disabledInvite={...redirected,signature:signValue(await loadSigningIdentity(dirs[0]),'field-desk-invite-v1',redirected)};await assert.rejects(()=>s.pull(disabledInvite),/revoked or unavailable/);
 console.log('Federation passed: three live instances, no transitive observations/reviews/counts, late-review isolation, origin-only returns, wrong-recipient rejection, exact previews, rejected third-party grants, legacy quarantine, provenance-preserving backups and disabled legacy invitations.');
}finally{for(const service of services)await service.close();for(const directory of dirs){if(!directory.startsWith(root+path.sep)||!path.basename(directory).startsWith('.local-storage-test-federation-'))throw Error('Unsafe cleanup path');await rm(directory,{recursive:true,force:true});}}
