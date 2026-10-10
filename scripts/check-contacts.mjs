import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startPeerSync} from '../lib/peer-sync.mjs';
import {fingerprint} from '../lib/sharing-auth.ts';
import {assessPackageTrust} from '../lib/peer-contacts.ts';
import {loadSigningIdentity,bindSigningIdentity,identityCard,signSavedPackage,signValue} from '../lib/signing-identity.mjs';
import {restorePortfolio,emptyContext} from '../lib/locations.ts';
import {createSharedGroup,stageContributions,makeSharedPackage,previewSharedMerge} from '../lib/sharing.ts';
const root=path.resolve(process.cwd()),dirs=await Promise.all(['a','b','fake'].map(n=>mkdtemp(path.join(root,'.local-storage-test-contacts-'+n+'-'))));let services=[];
const create=name=>{let p=createSharedGroup(restorePortfolio({...emptyContext(),schemaVersion:15,routes:[],notes:[{id:'fixture',name:'Synthetic bridge',lat:40,lng:-105,category:'Observation',source:'Synthetic field visit',detail:'Synthetic note'}]}),name+' group',name);return stageContributions(p,p.sharing.groups[0].id,['note:fixture']);};let a=create('John'),b=create('Sam');const groupId=a.sharing.groups[0].id,rid=a.sharing.groups[0].records[0].id;
async function call(service,route,body){const r=await fetch(`http://127.0.0.1:${service.state().controlPort}${route}`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
async function command(service,route,body){const r=await call(service,route,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
try{
 let hold=null,release=null;const j=await startPeerSync({directory:dirs[0],port:0,controlPort:0,studyReader:async()=>{if(hold)await hold;return a;}});services.push(j);
 const s=await startPeerSync({directory:dirs[1],port:0,controlPort:0,studyReader:async()=>b});services.push(s);const john=j.state().identity,sam=s.state().identity;
 const signed=await signSavedPackage(a,groupId,[rid],sam.member.id,await loadSigningIdentity(dirs[0]));
 let trust=await command(s,'/verify-package',{package:signed});assert.equal(trust.status,'Unknown');assert.equal(trust.trusted,false);
 await command(s,'/contacts/add',{label:'John at work',identity:john});assert.equal(s.state().contacts[0].status,'Pending');trust=await command(s,'/verify-package',{package:signed});assert.equal(trust.status,'Pending');
 assert.equal((await call(s,'/contacts/verify',{id:john.member.id,verifiedFingerprint:'wrong fingerprint'})).status,400);
 await command(s,'/contacts/verify',{id:john.member.id,verifiedFingerprint:await fingerprint(john.publicKey)});trust=await command(s,'/verify-package',{package:signed});assert.equal(trust.trusted,true);assert.equal(trust.status,'Verified');
 const forgedKey=await loadSigningIdentity(dirs[2]);await bindSigningIdentity(dirs[2],forgedKey,john.member);const forgedCard=identityCard(forgedKey,john.member);
 assert.equal((await call(s,'/contacts/add',{label:'Changed key',identity:forgedCard})).status,400);
 const forgedPackage=await signSavedPackage(a,groupId,[rid],sam.member.id,forgedKey);trust=await command(s,'/verify-package',{package:forgedPackage});assert.equal(trust.status,'Key changed');assert.equal(trust.trusted,false);
 // Even valid signatures from another verified contact do not grant John relay permission.
 const tim=create('Tim'),timGroup=tim.sharing.groups[0],timRecord=timGroup.records[0],timKey={...forgedKey,memberId:tim.sharing.member.id};
 const timPackage=await signSavedPackage(tim,timGroup.id,[timRecord.id],a.sharing.member.id,timKey),relay=previewSharedMerge(a,timPackage,'home').next;
 const relayed=await signSavedPackage(relay,timGroup.id,[timRecord.id],tim.sharing.member.id,await loadSigningIdentity(dirs[0]));
 const extraContact={id:tim.sharing.member.id,label:'Tim',publicKey:timKey.publicKey,identity:identityCard(timKey,tim.sharing.member),status:'Verified',verifiedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
 const thirdParty=await assessPackageTrust(relayed,b.sharing.member.id,sam.publicKey,[...s.state().contacts,extraContact],{[john.member.id]:john.publicKey,[tim.sharing.member.id]:timKey.publicKey});assert.equal(thirdParty.trusted,false);assert.match(thirdParty.reason,/third-party/);
 trust=await command(s,'/verify-package',{package:makeSharedPackage(a,groupId,[rid])});assert.equal(trust.status,'Unsigned');assert.equal(trust.legacyImportAllowed,undefined);
 const untouched=create('Unverified legacy sender');const legacy=makeSharedPackage(untouched,untouched.sharing.groups[0].id,[untouched.sharing.groups[0].records[0].id]);trust=await command(s,'/verify-package',{package:legacy});assert.equal(trust.legacyImportAllowed,true);
 const grantBody={groupId,label:'Sam',recordIds:[rid],recipientId:sam.member.id,recipientIdentity:sam,verifiedFingerprint:await fingerprint(sam.publicKey)};const invite=(await command(j,'/grants',grantBody)).invite;
 const peer=(await command(s,'/peers',{label:'John',invitation:JSON.stringify(invite),verifiedFingerprint:await fingerprint(john.publicKey)})).id;
 await command(s,'/sync',{id:peer});const before=b;b=previewSharedMerge(b,await s.pull(invite),'home').next;assert.notDeepEqual(b,before);
 const back=(await command(s,'/grants',{groupId,label:'John',recordIds:[rid],recipientId:john.member.id,recipientIdentity:john,verifiedFingerprint:await fingerprint(john.publicKey)})).invite;
 await command(s,'/contacts/disconnect',{id:john.member.id});assert.equal(s.state().peers.length,0);assert.equal(s.state().grants.length,0);assert.equal(s.state().contacts[0].status,'Verified');assert(b.sharing.groups.some(g=>g.id===groupId));await assert.rejects(()=>j.pull(back),/revoked/);
 const active=(await command(s,'/peers',{label:'John again',invitation:JSON.stringify(invite),verifiedFingerprint:await fingerprint(john.publicKey)})).id;
 hold=new Promise(r=>{release=r;});const pending=call(s,'/sync',{id:active});await new Promise(r=>setTimeout(r,40));
 await command(s,'/contacts/block',{id:john.member.id});release();hold=null;await pending;
 assert.equal(s.state().peers.length,0);assert.equal(s.state().contacts[0].status,'Blocked');trust=await command(s,'/verify-package',{package:signed});assert.equal(trust.status,'Blocked');assert.equal(trust.trusted,false);
 const aliasMember={id:crypto.randomUUID(),name:'John under a new ID'},aliasKey={...await loadSigningIdentity(dirs[0]),memberId:aliasMember.id},aliasCard=identityCard(aliasKey,aliasMember);
 assert.equal((await call(s,'/contacts/add',{label:'Blocked key alias',identity:aliasCard})).status,400);
 const aliasPortfolio=structuredClone(a);aliasPortfolio.sharing.member=aliasMember;const aliasRecord=aliasPortfolio.sharing.groups[0].records[0];aliasRecord.member=aliasMember;for(const source of Object.values(aliasPortfolio.sharing.groups[0].provenance))if(source.kind==='local')source.memberId=aliasMember.id;
 const aliasPackage=await signSavedPackage(aliasPortfolio,groupId,[rid],sam.member.id,aliasKey);assert.equal((await command(s,'/verify-package',{package:aliasPackage})).status,'Blocked');
 assert.equal((await call(s,'/peers',{label:'Blocked John',invitation:JSON.stringify(invite),verifiedFingerprint:await fingerprint(john.publicKey)})).status,400);
 await command(s,'/contacts/unblock',{id:john.member.id});assert.equal(s.state().contacts[0].status,'Pending');trust=await command(s,'/verify-package',{package:signed});assert.equal(trust.status,'Pending');assert.equal(s.state().peers.length,0);
 await command(s,'/contacts/verify',{id:john.member.id,verifiedFingerprint:await fingerprint(john.publicKey)});trust=await command(s,'/verify-package',{package:signed});assert(trust.trusted);
 // Publisher-side blocking revokes outgoing access, including requests already reading storage.
 hold=new Promise(r=>{release=r;});const reading=s.pull(invite).then(()=>false,e=>/revoked/.test(e.message));await new Promise(r=>setTimeout(r,40));await command(j,'/contacts/block',{id:sam.member.id});release();hold=null;assert(await reading,'Publisher must recheck revocation after an awaited study read');assert.equal(j.state().grants.length,0);await assert.rejects(()=>s.pull(invite),/revoked/);assert.equal((await call(j,'/grants',grantBody)).status,400);
 await s.close();services=services.filter(v=>v!==s);const file=path.join(dirs[1],'peer-sync.json'),config=JSON.parse(await readFile(file,'utf8'));assert.equal(config.contacts[0].status,'Verified');assert.equal(config.pins[john.member.id],john.publicKey);
 const restarted=await startPeerSync({directory:dirs[1],port:0,controlPort:0,studyReader:async()=>b});services.push(restarted);assert.equal(restarted.state().contacts[0].label,'John at work');assert.equal((await command(restarted,'/verify-package',{package:signed})).trusted,true);
 await restarted.close();services=services.filter(v=>v!==restarted);delete config.contacts;await writeFile(file,JSON.stringify(config));const migrated=await startPeerSync({directory:dirs[1],port:0,controlPort:0,studyReader:async()=>b});services.push(migrated);assert.equal(migrated.state().contacts[0].status,'Verified');assert.equal(migrated.state().contacts[0].verifiedAt,null);
 const ownKey=await loadSigningIdentity(dirs[1]);assert.equal((await assessPackageTrust(forgedPackage,b.sharing.member.id,ownKey.publicKey,migrated.state().contacts,config.pins)).status,'Key changed');
 console.log('Contacts passed: pending/verified/blocked lifecycle, wrong fingerprint/key rejection, signed-file/live trust parity, known-identity unsigned downgrade rejection, explicit legacy handling, disconnect with pin retention, blocked in-flight sync without resurrection, revoked outgoing access, unblock without reconnection, persistence and legacy-pin migration.');
}finally{for(const service of services)await service.close();for(const dir of dirs){if(!dir.startsWith(root+path.sep)||!path.basename(dir).startsWith('.local-storage-test-contacts-'))throw Error('Unsafe cleanup');await rm(dir,{recursive:true,force:true});}}
