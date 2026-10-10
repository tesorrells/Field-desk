import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {restorePortfolio,emptyContext} from '../lib/locations.ts';
import {makeBackup,parseBackup} from '../lib/backup.ts';
import {createSharedGroup,stageContributions,makeSharedPackage,parseSharedPackage,previewSharedMerge,addSharedReview} from '../lib/sharing.ts';
import {loadSigningIdentity,bindSigningIdentity,identityCard,signSavedPackage,signValue,verifyValue} from '../lib/signing-identity.mjs';
import {verifySignedPackage,verifyIdentity,fingerprint,canonical,packageBody} from '../lib/sharing-auth.ts';
const root=path.resolve(process.cwd()),aDir=await mkdtemp(path.join(root,'.local-storage-test-signatures-a-')),bDir=await mkdtemp(path.join(root,'.local-storage-test-signatures-b-'));
try{
 let a=createSharedGroup(restorePortfolio({...emptyContext(),schemaVersion:14,routes:[],notes:[{id:'fixture',name:'Synthetic bridge',lat:40,lng:-105,category:'Observation',source:'Field visit',detail:'Inspection due'}]}),'Fixture colleagues','Contributor A');const groupId=a.sharing.groups[0].id;a=stageContributions(a,groupId,['note:fixture']);const record=a.sharing.groups[0].records[0],rid=record.id,vid=record.revisions[0].id;
 let b=createSharedGroup(restorePortfolio({...emptyContext(),schemaVersion:14,routes:[]}), 'Recipient personal group','Contributor B');
 const aKey=await loadSigningIdentity(aDir),bKey=await loadSigningIdentity(bDir);await bindSigningIdentity(aDir,aKey,a.sharing.member);await bindSigningIdentity(bDir,bKey,b.sharing.member);
 const card=identityCard(aKey,a.sharing.member);assert.deepEqual(await verifyIdentity(card),card);assert.match(await fingerprint(card.publicKey),/^(?:[0-9a-f]{8} ){7}[0-9a-f]{8}$/);
 await assert.rejects(()=>verifyIdentity({...card,member:{...card.member,name:'Altered name'}}));
 assert(!JSON.stringify(card).includes(aKey.privateKey));assert.deepEqual(await loadSigningIdentity(aDir),aKey);
 await assert.rejects(()=>bindSigningIdentity(aDir,aKey,b.sharing.member),/differs/);
 assert(verifyValue(aKey.publicKey,'domain-a',{test:1},signValue(aKey,'domain-a',{test:1})));assert(!verifyValue(aKey.publicKey,'domain-b',{test:1},signValue(aKey,'domain-a',{test:1})));
 const signed=await signSavedPackage(a,groupId,[rid],b.sharing.member.id,aKey);assert.equal(signed.formatVersion,2);assert(!JSON.stringify(signed).includes(aKey.privateKey));assert(!JSON.stringify(signed).includes('provenance'));
 const transported=parseSharedPackage(JSON.stringify(signed));assert.throws(()=>previewSharedMerge(b,transported,'home'),/Verify this signed package/);await verifySignedPackage(transported);b=previewSharedMerge(b,transported,'home').next;assert(b.sharing.groups.find(g=>g.id===groupId).signatures[rid+':'+vid]);
 b=addSharedReview(b,groupId,rid,{revisionId:vid,status:'Confirmed',observedAt:'2026-10-09T12:00:00Z',comment:'Checked the deck'});
 const returned=await signSavedPackage(b,groupId,[rid],a.sharing.member.id,bKey);assert.equal(returned.auth.events[rid+':'+vid].publicKey,aKey.publicKey);assert.equal(returned.auth.events[rid+':'+returned.records[0].reviews[0].id].publicKey,bKey.publicKey);
 a=previewSharedMerge(a,returned,'home').next;assert.deepEqual(parseBackup(JSON.stringify(makeBackup(a,[]))).backup.study,a);
 for(const change of [p=>{p.records[0].revisions[0].payload.detail='Tampered observation';},p=>{p.records[0].reviews[0].comment='Tampered review';},p=>{p.records[0].member.name='Different author';},p=>{p.group.id=crypto.randomUUID();},p=>{p.createdAt='2026-01-01T00:00:00Z';}]){const changed=structuredClone(returned);change(changed);await assert.rejects(()=>verifySignedPackage(changed),/invalid/);}
 // A valid publisher envelope cannot disguise a forged original author's event.
 const forged=structuredClone(returned),key=rid+':'+vid;forged.auth.events[key].signature=signValue(bKey,'field-desk-event-v1',{});forged.auth.signature=signValue(bKey,'field-desk-package-v1',packageBody(forged));await assert.rejects(()=>verifySignedPackage(forged),/contribution or review/);
 const edited=structuredClone(returned);await verifySignedPackage(edited);edited.records[0].reviews[0].comment='Edited after verification';assert.throws(()=>previewSharedMerge(a,edited,'home'),/Verify/);
 const unsigned=makeSharedPackage(a,groupId,[rid]);assert.equal((await verifySignedPackage(unsigned)).signed,false);assert.equal(unsigned.auth,undefined);
 const originalKey=await readFile(path.join(aDir,'field-desk-identity.json'),'utf8');await writeFile(path.join(aDir,'field-desk-identity.json'),'{invalid');await assert.rejects(()=>loadSigningIdentity(aDir),/invalid/);assert.equal(await readFile(path.join(aDir,'field-desk-identity.json'),'utf8'),'{invalid');await writeFile(path.join(aDir,'field-desk-identity.json'),originalKey);await unlink(path.join(aDir,'field-desk-identity.json'));await assert.rejects(()=>loadSigningIdentity(aDir,true),/missing/);
 console.log('Signatures passed: persisted/bound Ed25519 identity, public fingerprints, independent author/review signatures, original-key preservation on return, merge-before-verification rejection, body/author/group/date tampering, forged event rejection, post-verification mutation, private-key exclusion, unsigned legacy handling, backup round trip and missing/corrupt key fail-closed recovery.');
}finally{for(const dir of [aDir,bDir]){if(!dir.startsWith(root+path.sep)||!path.basename(dir).startsWith('.local-storage-test-signatures-'))throw Error('Unsafe test cleanup');await rm(dir,{recursive:true,force:true});}}
