import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {startPeerSync} from '../lib/peer-sync.mjs';
import {openPeerInbox,inboxDigest} from '../lib/peer-inbox.mjs';
import {fingerprint,verifySignedPackage} from '../lib/sharing-auth.ts';
import {restorePortfolio,emptyContext,updateActive} from '../lib/locations.ts';
import {createSharedGroup,stageContributions,previewSharedMerge,parseSharedPackage} from '../lib/sharing.ts';
const root=await mkdtemp(path.join(tmpdir(),'field-desk-inbox-')),aDir=path.join(root,'a'),bDir=path.join(root,'b');await mkdir(aDir);await mkdir(bDir);
let a=createSharedGroup(restorePortfolio({...emptyContext(),notes:[{id:'fixture',name:'Synthetic bridge',lat:40,lng:-105,category:'Observation',source:'Synthetic inspection',detail:'Initial fixture'}]}),'Synthetic group','Fixture Sam');
a=stageContributions(a,a.sharing.groups[0].id,['note:fixture']);let b=createSharedGroup(restorePortfolio(emptyContext()),'Private fixture group','Fixture John');
let publisher,recipient,offline=false;const recipientOptions={directory:bDir,port:0,controlPort:0,studyReader:async()=>b,fetcher:(...args)=>{if(offline)throw Error('Fixture offline');return fetch(...args);}};
async function call(service,route,body){const response=await fetch(`http://127.0.0.1:${service.state().controlPort}${route}`,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
async function command(service,route,body){const result=await call(service,route,body);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
async function decide(entry,state,reason=''){return command(recipient,'/inbox/review',{id:entry.id,digest:entry.digest,state,reason,expectedState:entry.state,expectedReviewedAt:entry.reviewedAt});}
try{
 publisher=await startPeerSync({directory:aDir,port:0,controlPort:0,studyReader:async()=>a});recipient=await startPeerSync(recipientOptions);
 const sender=publisher.state().identity,receiver=recipient.state().identity,gid=a.sharing.groups[0].id,rid=a.sharing.groups[0].records[0].id;
 const invite=(await command(publisher,'/grants',{groupId:gid,label:'Fixture recipient',recordIds:[rid],recipientId:receiver.member.id,recipientIdentity:receiver,verifiedFingerprint:await fingerprint(receiver.publicKey)})).invite;
 const peerId=(await command(recipient,'/peers',{label:'Fixture sender',invitation:JSON.stringify(invite),verifiedFingerprint:await fingerprint(sender.publicKey)})).id;
 await command(recipient,'/sync',{id:peerId});let entry=recipient.state().inbox[0];assert.equal(entry.state,'Pending');assert.equal(recipient.state().inboxSummary.pending,1);
 const first=await command(recipient,'/inbox-entry/'+entry.id);assert.equal(first.package.records.length,1);const digest=inboxDigest(first.package);
 await command(recipient,'/sync',{id:peerId});assert.equal(recipient.state().inbox.length,1,'Re-signing/envelope dates do not duplicate unchanged content');
 assert.equal((await call(recipient,'/inbox/review',{...entry,state:'Dismissed',reason:'',expectedState:entry.state,expectedReviewedAt:entry.reviewedAt})).status,400);
 await decide(entry,'Deferred','Inspect in person first');assert.equal(recipient.state().inboxSummary.deferred,1);
 await recipient.close();recipient=await startPeerSync(recipientOptions);
 entry=recipient.state().inbox[0];assert.equal(entry.state,'Deferred');assert.equal(entry.reason,'Inspect in person first');assert(recipient.state().inboxSummary.lastSuccess,'Sync date survives restart');
 await command(recipient,'/sync',{id:peerId});assert.equal(recipient.state().inbox[0].state,'Deferred');
 offline=true;assert.equal((await call(recipient,'/sync',{id:peerId})).status,400);assert.equal((await command(recipient,'/inbox-entry/'+entry.id)).stale,true);offline=false;
 a=updateActive(a,s=>({...s,notes:s.notes.map(n=>({...n,detail:'Updated synthetic inspection'}))}));a=stageContributions(a,gid,['note:fixture']);
 await command(recipient,'/sync',{id:peerId});assert.equal(recipient.state().inbox.length,2,'New content cannot replace older pending/deferred package');
 let next=recipient.state().inbox.find(e=>e.state==='Pending');assert.notEqual(next.digest,digest);
 assert.equal((await call(recipient,'/inbox/review',{id:next.id,digest:next.digest,state:'Merged',reason:'',expectedState:next.state,expectedReviewedAt:next.reviewedAt})).status,400,'On-screen/unsaved content cannot certify merged');
 const incoming=parseSharedPackage(JSON.stringify((await command(recipient,'/inbox-entry/'+next.id)).package));await verifySignedPackage(incoming);b=previewSharedMerge(b,incoming,'home',peerId).next;
 await decide(next,'Merged','Saved and inspected');assert.equal(recipient.state().inbox.find(e=>e.id===next.id).state,'Merged');
 assert.equal((await call(recipient,'/inbox/review',{id:next.id,digest:next.digest,state:'Dismissed',reason:'Stale tab',expectedState:'Pending',expectedReviewedAt:null})).status,400,'Stale review cannot replace a newer decision');
 entry=recipient.state().inbox.find(e=>e.state==='Deferred');await decide(entry,'Dismissed','Superseded by inspected update');
 assert.equal((await command(recipient,'/inbox/clear-reviewed',{})).count,2);assert.equal(recipient.state().inbox.length,0);
 await recipient.close();recipient=await startPeerSync(recipientOptions);await command(recipient,'/sync',{id:peerId});assert.equal(recipient.state().inbox.length,0,'Cleared receipt survives restart and suppresses duplicate');
 a=updateActive(a,s=>({...s,notes:s.notes.map(n=>({...n,detail:'Third synthetic inspection'}))}));a=stageContributions(a,gid,['note:fixture']);await command(recipient,'/sync',{id:peerId});assert.equal(recipient.state().inboxSummary.pending,1);
 await recipient.close();recipient=null;
 const fixtureDb=new DatabaseSync(path.join(bDir,'peer-inbox.sqlite'));
 const original=fixtureDb.prepare('SELECT id,package FROM inbox_entries').get();
 const tampered=JSON.parse(original.package);tampered.records[0].revisions[0].payload.detail='Tampered disk fixture';
 fixtureDb.prepare('UPDATE inbox_entries SET package=? WHERE id=?').run(JSON.stringify(tampered),original.id);fixtureDb.close();
 await assert.rejects(()=>startPeerSync(recipientOptions),/invalid|verification/i,'Restart must reverify persisted signatures');
 const recoveryDb=new DatabaseSync(path.join(bDir,'peer-inbox.sqlite'));assert.equal(JSON.parse(recoveryDb.prepare('SELECT package FROM inbox_entries WHERE id=?').get(original.id).package).records[0].revisions[0].payload.detail,'Tampered disk fixture','Bad disk data is retained for recovery rather than silently reset');recoveryDb.prepare('UPDATE inbox_entries SET package=? WHERE id=?').run(original.package,original.id);recoveryDb.close();
 recipient=await startPeerSync(recipientOptions);assert.equal(recipient.state().inboxSummary.pending,1);
 await command(recipient,'/contacts/block',{id:sender.member.id});assert.equal(recipient.state().inbox.length,0);assert.equal(recipient.state().peers.length,0);assert(b.sharing.groups.some(g=>g.id===gid),'Block preserves saved study');
 // Bound retention without evicting pending packages; real transport/schema still verify every input.
 const boundedDir=path.join(root,'bounded');await mkdir(boundedDir);const store=openPeerInbox(boundedDir);
 try{for(let i=0;i<128;i++)store.receive(peerId,{...first.package,group:{...first.package.group,name:'Fixture '+i}});assert.throws(()=>store.receive(peerId,{...first.package,group:{...first.package.group,name:'Overflow'}}),/Inbox full/);assert.equal(store.entries().length,128);assert.equal(store.clearReviewed(),0,'Pending capacity cannot be cleared silently');}finally{store.close();}
 await recipient.close();recipient=null;await publisher.close();publisher=null;
 console.log('Persistent inbox passed: signed two-instance pulls, restart retention, content deduplication, deferred reasons, stale fallback, new-content history, saved-only merge acknowledgment, optimistic review conflicts, cleared receipts, tampered-disk recovery, blocking isolation and capacity retention.');
}finally{await recipient?.close();await publisher?.close();if(!root.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(root).startsWith('field-desk-inbox-'))throw Error('Unexpected inbox fixture cleanup path');await rm(root,{recursive:true,force:true});}
