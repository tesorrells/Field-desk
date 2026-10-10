import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRecoveryKit,previewRecoveryKit,restoreRecoveryKit,recoverLostIdentity,decryptRecoveryBundle,encryptRecoveryBundle} from '../lib/identity-recovery.mjs';
import {openLocalDatabase} from '../lib/local-database.mjs';
import {emptyContext,restorePortfolio} from '../lib/locations.ts';
import {createSharedGroup,stageContributions,makeSharedPackage} from '../lib/sharing.ts';
import {startPeerSync} from '../lib/peer-sync.mjs';
import {loadSigningIdentity,signSavedPackage,signValue} from '../lib/signing-identity.mjs';
import {fingerprint,verifySignedPackage} from '../lib/sharing-auth.ts';
let study=createSharedGroup(restorePortfolio({...emptyContext(),home:{address:'PRIVATE fixture address',point:[40,-105]},notes:[{id:'one',name:'Fixture bridge',lat:40,lng:-105,category:'Field',source:'Fixture',detail:'Synthetic inspection'}]}),'Fixture work','John');
const gid=study.sharing.groups[0].id;study=stageContributions(study,gid,['note:one']);const rid=study.sharing.groups[0].records[0].id;
const sam=createSharedGroup(restorePortfolio(emptyContext()),'Sam fixture','Sam');
const root=await mkdtemp(path.join(tmpdir(),'field-desk-recovery-test-')),source=path.join(root,'source'),remote=path.join(root,'remote'),kit=path.join(root,'private.field-desk-recovery'),pass='Synthetic long passphrase only';let local,peer;
async function saved(directory){const db=openLocalDatabase(directory);try{return restorePortfolio(JSON.parse((await db.prepare("SELECT content FROM studies WHERE id='primary'").first()).content));}finally{db.close();}}
try{
 const db=openLocalDatabase(source);await db.prepare('INSERT INTO studies(id,content,updated_at) VALUES (?,?,?)').bind('primary',JSON.stringify(study),new Date().toISOString()).run();db.close();
 local=await startPeerSync({directory:source,port:0,controlPort:0,studyReader:async()=>saved(source)});
 peer=await startPeerSync({directory:remote,port:0,controlPort:0,studyReader:async()=>sam});
 const card=peer.state().identity,response=await fetch(`http://127.0.0.1:${local.state().controlPort}/grants`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},body:JSON.stringify({groupId:gid,label:'Fixture Sam',recordIds:[rid],recipientId:sam.sharing.member.id,recipientIdentity:card,verifiedFingerprint:await fingerprint(card.publicKey)})});
 assert.equal(response.status,200);const invite=(await response.json()).invite;
 await assert.rejects(()=>createRecoveryKit(source,kit,pass,{serversStopped:true}),/lock/);
 const localCard=local.state().identity;await local.close();local=null;
 const syncFile=path.join(source,'peer-sync.json'),originalConfig=JSON.parse(await readFile(syncFile,'utf8'));
 const reciprocal={...invite,publisher:sam.sharing.member,publisherIdentity:card,recipientIdentity:localCard,recipientId:study.sharing.member.id,endpoint:peer.state().endpoint,grantId:crypto.randomUUID()};delete reciprocal.signature;reciprocal.signature=signValue(await loadSigningIdentity(remote,true),'field-desk-invite-v1',reciprocal);originalConfig.peers=[{id:crypto.randomUUID(),label:'Fixture reciprocal Sam',invite:reciprocal,automatic:true}];await writeFile(syncFile,JSON.stringify(originalConfig));
 await assert.rejects(()=>createRecoveryKit(source,kit,pass),/Stop/);
 await assert.rejects(()=>createRecoveryKit(source,kit,'short',{serversStopped:true}),/12/);
 const key=await loadSigningIdentity(source,true),summary=await createRecoveryKit(source,kit,pass,{serversStopped:true});
 assert.equal(summary.contributor.id,study.sharing.member.id);assert.equal(summary.outgoing,1);
 const text=await readFile(kit,'utf8');assert(!text.includes('PRIVATE fixture address'));assert(!text.includes(key.privateKey));assert(!text.includes(invite.secret));assert(!text.includes('Fixture bridge'));
 await assert.rejects(()=>createRecoveryKit(source,kit,pass,{serversStopped:true}),e=>e.code==='EEXIST');
 await assert.rejects(()=>previewRecoveryKit(kit,'Wrong synthetic passphrase'),/Wrong passphrase/);
 const changed=JSON.parse(text);changed.tag=(changed.tag[0]==='a'?'b':'a')+changed.tag.slice(1);await assert.rejects(()=>decryptRecoveryBundle(JSON.stringify(changed),pass),/altered/);
 const preview=await previewRecoveryKit(kit,pass),destination=path.join(root,'restored');
 await assert.rejects(async()=>restoreRecoveryKit(kit,destination,pass,{serversStopped:true,confirmedContributorId:'wrong',confirmedFingerprint:await fingerprint(key.publicKey)}),/Confirm/);
 await assert.rejects(()=>stat(destination),e=>e.code==='ENOENT');
 await restoreRecoveryKit(kit,destination,pass,{serversStopped:true,confirmedContributorId:preview.contributor.id,confirmedFingerprint:await fingerprint(preview.publicKey)});
 assert.deepEqual(await saved(destination),study);assert.equal((await loadSigningIdentity(destination,true)).privateKey,key.privateKey);
 const restoredConfig=JSON.parse(await readFile(path.join(destination,'peer-sync.json'),'utf8'));assert.equal(restoredConfig.grants[0].secret,invite.secret);assert.deepEqual(restoredConfig.grants[0].recordIds,[rid]);assert.equal(restoredConfig.peers[0].automatic,false);assert.equal(restoredConfig.peers[0].invite.signature,reciprocal.signature);
 await assert.rejects(async()=>restoreRecoveryKit(kit,destination,pass,{serversStopped:true,confirmedContributorId:preview.contributor.id,confirmedFingerprint:await fingerprint(preview.publicKey)}),/unused/);
 const bundle=await decryptRecoveryBundle(text,pass),mismatch=structuredClone(bundle);mismatch.identity.memberId=crypto.randomUUID();await assert.rejects(()=>encryptRecoveryBundle(mismatch,pass),/match/);
 const signed=await signSavedPackage(await saved(destination),gid,[rid],sam.sharing.member.id,await loadSigningIdentity(destination,true));await verifySignedPackage(signed);
 // Missing key recovery deliberately changes identity, while original history remains immutable.
 await rm(path.join(source,'field-desk-identity.json'));
 await assert.rejects(()=>loadSigningIdentity(source),/missing/,'Public binding prevents replacement even without an explicit requireExisting flag');
 const replacement=path.join(root,'recovered'),result=await recoverLostIdentity(source,replacement,{serversStopped:true,confirmedContributorId:study.sharing.member.id,reason:'Fixture lost signing key'});
 assert.notEqual(result.contributor.id,study.sharing.member.id);assert.notEqual(result.publicKey,key.publicKey);
 const next=await saved(replacement);assert.deepEqual(next.sharing.groups,study.sharing.groups);assert.equal(makeSharedPackage(next,gid,[rid],sam.sharing.member.id).records.length,0,'Historical authorship is not silently reassigned to the new key');
 const nextConfig=JSON.parse(await readFile(path.join(replacement,'peer-sync.json'),'utf8'));assert.equal(nextConfig.grants.length,0);assert.equal(nextConfig.peers.length,0);assert.equal(nextConfig.pins[sam.sharing.member.id],card.publicKey);
 await assert.rejects(()=>startPeerSync({directory:source,port:0,controlPort:0,studyReader:async()=>saved(source)}),/retired/);
 await assert.rejects(()=>createRecoveryKit(source,path.join(root,'retired.field-desk-recovery'),pass,{serversStopped:true}),/retired/);
 const fresh=await startPeerSync({directory:replacement,port:0,controlPort:0,studyReader:async()=>saved(replacement)});assert.equal(fresh.state().identity.member.id,result.contributor.id);await fresh.close();
 console.log('Identity recovery passed: offline lock, encrypted private study/key/credential backup, wrong password/tamper rejection, no overwrite, preview identity/fingerprint confirmation, exact key/scope migration, signing continuity, deliberate new identity, retained old history/provenance, old directory retirement and no inherited grants or polling.');
}finally{
 await local?.close();await peer?.close();
 if(!root.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(root).startsWith('field-desk-recovery-test-'))throw Error('Unexpected fixture directory');
 await rm(root,{recursive:true,force:true});
}
