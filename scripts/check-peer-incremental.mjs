import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {sharedRecordDigest} from '../lib/peer-batches.mjs';
import {canonical} from '../lib/sharing-auth.ts';
import {startPeerSync,openPeer,sealPeer} from '../lib/peer-sync.mjs';
import {createSharedGroup,stageContributions,previewSharedMerge} from '../lib/sharing.ts';
import {emptyContext,restorePortfolio} from '../lib/locations.ts';
import {verifySignedPackage,fingerprint} from '../lib/sharing-auth.ts';
let a=createSharedGroup(restorePortfolio({...emptyContext(),notes:Array.from({length:220},(_,i)=>({id:'fixture-'+i,name:'Fixture bridge '+i,lat:40,lng:-105,category:'Field',source:'Fixture',detail:'x'.repeat(10000)}))}),'Large work study','John');
const gid=a.sharing.groups[0].id;a=stageContributions(a,gid,a.notes.map(n=>'note:'+n.id));const ids=a.sharing.groups[0].records.map(r=>r.id);
let b=createSharedGroup(restorePortfolio({...emptyContext(),sections:{Terrain:'PRIVATE Sam narrative'}}),'Private Sam group','Sam');
let tim=createSharedGroup(restorePortfolio({...emptyContext(),notes:[{id:'tim',name:'PRIVATE Tim contribution',lat:40,lng:-105,category:'Field',source:'Fixture',detail:'Tim-only history'}]}),'Tim group','Tim');const tgid=tim.sharing.groups[0].id;tim=stageContributions(tim,tgid,['note:tim']);const tid=tim.sharing.groups[0].records[0].id;
const root=await mkdtemp(path.join(tmpdir(),'field-desk-incremental-'));let sa,sb,sc;const invites=new Map(),wire=[];let failAfter=1,requests=0;
async function control(s,route,body){const response=await fetch(`http://127.0.0.1:${s.state().controlPort}${route}`,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
async function command(s,route,body){const result=await control(s,route,body);assert.equal(result.status,200,JSON.stringify({response:result.data,peers:s.state().peers,trace:wire.slice(-4).map(w=>({known:w.known.length,got:w.package.records.length,remaining:w.package.exchange?.remaining,first:w.package.records[0]?.id,knownFirst:w.known[0]?.id}))}));if(result.data.package)await verifySignedPackage(result.data.package);return result.data;}
async function grant(source,groupId,recordIds,recipient){const card=recipient.state().identity;return (await command(source,'/grants',{groupId,label:'Synthetic recipient',recordIds,recipientId:card.member.id,recipientIdentity:card,verifiedFingerprint:await fingerprint(card.publicKey)})).invite;}
async function connect(invite){invites.set(invite.grantId,invite);return (await command(sb,'/peers',{label:invite.publisher.name,invitation:JSON.stringify(invite),verifiedFingerprint:await fingerprint(invite.publisherIdentity.publicKey)})).id;}
const fetcher=async(url,options)=>{
 const invite=invites.get(new URL(url).pathname.split('/').at(-1)),context=`v1:${invite.grantId}:${invite.groupId}`,request=openPeer(JSON.parse(options.body),invite.secret,'request',context);
 if(failAfter!==null&&requests++>=failAfter)throw Error('Synthetic interruption after one retained batch');
 const response=await fetch(url,options),text=await response.clone().text();if(response.ok){const value=openPeer(JSON.parse(text),invite.secret,'response',context+':'+request.requestId);assert(!text.includes('Fixture bridge'));assert(!text.includes('PRIVATE'));for(const record of value.package?.records||[]){const original=a.sharing.groups.find(g=>g.id===value.package.group.id)?.records.find(r=>r.id===record.id);if(original)assert.equal(sharedRecordDigest(record),sharedRecordDigest(original),JSON.stringify({before:canonical(original).slice(0,800),after:canonical(record).slice(0,800)}));}wire.push({grantId:invite.grantId,known:request.known||[],package:value.package,bytes:Buffer.byteLength(text),request,box:JSON.parse(options.body)});}return response;
};
try{
 sa=await startPeerSync({directory:path.join(root,'a'),port:0,controlPort:0,studyReader:async()=>a});
 sb=await startPeerSync({directory:path.join(root,'b'),port:0,controlPort:0,studyReader:async()=>b,fetcher});
 sc=await startPeerSync({directory:path.join(root,'c'),port:0,controlPort:0,studyReader:async()=>tim});
 const invite=await grant(sa,gid,ids,sb),peerId=await connect(invite);
 assert.equal((await control(sb,'/sync',{id:peerId})).status,400);assert.equal(sb.state().inbox.length,1);assert(sb.state().peers[0].error);assert.equal(b.sharing.groups.length,1,'Partial transfer never auto-merges');
 failAfter=null;await command(sb,'/sync',{id:peerId});assert.equal(sb.state().inbox.length,3);assert.deepEqual(wire.map(w=>w.package.records.length),[100,100,20]);assert.equal(wire[1].known.length,100,'Retry resumes after retained first batch');
 const initialBytes=wire.reduce((n,w)=>n+w.bytes,0);await command(sb,'/sync',{id:peerId});assert.equal(wire.at(-1).package.records.length,0);assert.equal(sb.state().inbox.length,3);assert(wire.at(-1).bytes<initialBytes*.01,'Unchanged pull avoids nearly all previous payload bytes');
 for(const entry of sb.state().inbox){const pkg=(await command(sb,'/inbox-entry/'+entry.id)).package;b=previewSharedMerge(b,pkg,'home').next;}
 assert.equal(b.sharing.groups.find(g=>g.id===gid).records.length,220);const selected={...b.sharing.groups.find(g=>g.id===gid).selected};
 await sb.close();sb=await startPeerSync({directory:path.join(root,'b'),port:0,controlPort:0,studyReader:async()=>b,fetcher});await command(sb,'/sync',{id:peerId});assert.equal(wire.at(-1).package.records.length,0,'Known content persists across restart');
 a={...a,notes:a.notes.map(n=>n.id==='fixture-37'?{...n,detail:'Corrected synthetic inspection'}:n)};a=stageContributions(a,gid,['note:fixture-37'],'Fixture correction');await command(sb,'/sync',{id:peerId});assert.equal(wire.at(-1).package.records.length,1);assert.equal(wire.at(-1).package.records[0].revisions.length,2,'Changed records retain complete signed history');
 const updated=wire.at(-1).package;await verifySignedPackage(updated);b=previewSharedMerge(b,updated,'home').next;assert.deepEqual(b.sharing.groups.find(g=>g.id===gid).selected,selected);
 const timInvite=await grant(sc,tgid,[tid],sb),timPeer=await connect(timInvite);await command(sb,'/sync',{id:timPeer});assert.equal(wire.at(-1).known.length,0,'John ledger is not supplied to Tim');await command(sb,'/sync',{id:peerId});assert(wire.at(-1).known.every(r=>ids.includes(r.id)));assert(!wire.at(-1).known.some(r=>r.id===tid),'Tim receipt is not advertised to John');
 const sample=wire.find(w=>w.grantId===invite.grantId),forged={...sample.request,requestId:crypto.randomUUID(),known:[{id:tid,digest:'a'.repeat(64)}]},ctx=`v1:${invite.grantId}:${gid}`;
 const altered=sealPeer(forged,invite.secret,'request',ctx);assert.equal((await fetch(invite.endpoint+'/v1/pull/'+invite.grantId,{method:'POST',body:JSON.stringify(altered)})).status,404,'Inventory changes invalidate the recipient signature');
 await command(sb,'/sync',{id:peerId,full:true});assert.deepEqual(wire.filter(w=>w.grantId===invite.grantId).slice(-3).map(w=>w.package.records.length),[100,100,20]);
 console.log('Incremental peer exchange passed: 220 signed records in bounded batches, interrupted-transfer resume, unchanged byte reduction, restart ledger retention, full changed-record history, chosen revisions preserved, no auto-merge, per-peer manifest isolation, inventory signature tamper rejection and explicit full-scope recheck.');
}finally{
 await sa?.close();await sb?.close();await sc?.close();
 if(!root.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(root).startsWith('field-desk-incremental-'))throw Error('Unexpected fixture cleanup path');await rm(root,{recursive:true,force:true});
}
