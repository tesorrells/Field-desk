import {verifySignedPackage,fingerprint} from '../lib/sharing-auth.ts';
import {signValue,loadSigningIdentity,identityCard,bindSigningIdentity} from '../lib/signing-identity.mjs';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startPeerSync,sealPeer,openPeer,parsePeerInvite,privateHost,peerEndpoint,pullPeer} from '../lib/peer-sync.mjs';
import {emptyContext,restorePortfolio,updateActive} from '../lib/locations.ts';
import {createSharedGroup,stageContributions,previewSharedMerge,addSharedReview,reviewSummary} from '../lib/sharing.ts';
import {localRequestAllowed} from '../lib/local-request.ts';
const key=randomBytes(32).toString('base64url'),context='test-context',value={test:'PRIVATE synthetic message'},box=sealPeer(value,key,'request',context);
assert.deepEqual(openPeer(box,key,'request',context),value);
assert.throws(()=>openPeer(box,randomBytes(32).toString('base64url'),'request',context));assert.throws(()=>openPeer(box,key,'response',context));assert.throws(()=>openPeer(box,key,'request','wrong context'));
assert.throws(()=>openPeer({...box,tag:randomBytes(16).toString('base64url')},key,'request',context));
assert.equal(privateHost('192.168.1.10'),'192.168.1.10');assert.equal(privateHost('localhost'),'127.0.0.1');assert.equal(peerEndpoint('http://localhost:5186'),'http://127.0.0.1:5186');
for(const host of ['0.0.0.0','8.8.8.8','169.254.169.254','192.168.1.256','evil.example','172.15.1.1'])assert.throws(()=>privateHost(host));
for(const url of ['https://127.0.0.1:5186','http://user:pass@127.0.0.1:5186','http://127.0.0.1:5186/private','http://127.0.0.1:5186/?token=secret','http://8.8.8.8:5186'])assert.throws(()=>peerEndpoint(url));
assert(!localRequestAllowed(new Request('http://192.168.1.10/api/study')));
const fixture={id:'fixture-note',name:'Bridge inspection',lat:40,lng:-105,category:'Observation',source:'Field visit',detail:'West deck requires inspection'};
let a=restorePortfolio({...emptyContext(),schemaVersion:13,home:{address:'PRIVATE ADDRESS',point:[40,-105]},notes:[fixture,{...fixture,id:'private-note',name:'PRIVATE NOTE'}],sections:{Terrain:'PRIVATE NARRATIVE'},routes:[]});
a=createSharedGroup(a,'Fixture colleagues','Fixture A');const groupId=a.sharing.groups[0].id;a=stageContributions(a,groupId,['note:fixture-note']);const record=a.sharing.groups[0].records[0],recordId=record.id,revisionId=record.revisions[0].id;
let b=restorePortfolio({...emptyContext(),schemaVersion:13,notes:[{...fixture,name:'Keep private local note'}],routes:[]});b=createSharedGroup(b,'Recipient personal group','Fixture B');
const root=path.resolve(process.cwd()),directoryA=await mkdtemp(path.join(root,'.local-storage-test-sync-a-')),directoryB=await mkdtemp(path.join(root,'.local-storage-test-sync-b-'));
let serviceA,serviceB;const wire=[];
async function control(service,route,body,headers={}){return fetch(`http://127.0.0.1:${service.state().controlPort}${route}`,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function command(service,route,body){if(route==='/grants'||route==='/preview'){const card=[serviceA,serviceB].map(s=>s?.state().identity).find(c=>c?.member.id===body.recipientId);body={...body,recipientIdentity:card,verifiedFingerprint:await fingerprint(card.publicKey)};}if(route==='/peers'){const invite=JSON.parse(body.invitation);body={...body,verifiedFingerprint:await fingerprint(invite.publisherIdentity.publicKey)};}const response=await control(service,route,body),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));if(data.package)await verifySignedPackage(data.package);return data;}
try{
 serviceA=await startPeerSync({directory:directoryA,port:0,controlPort:0,studyReader:async()=>a});
 serviceB=await startPeerSync({directory:directoryB,port:0,controlPort:0,pollMs:50,studyReader:async()=>b,fetcher:async(url,options)=>{wire.push(options.body);const response=await fetch(url,options);wire.push(await response.clone().text());return response;}});
 const inviteA=(await command(serviceA,'/grants',{groupId,label:'Fixture B',recordIds:[recordId],recipientId:b.sharing.member.id})).invite;parsePeerInvite(JSON.stringify(inviteA));
 assert(!JSON.stringify(await command(serviceA,'/state')).includes(inviteA.secret));assert(!JSON.stringify(await command(serviceA,'/state')).includes('PRIVATE ADDRESS'));
 assert.equal((await control(serviceA,'/state',undefined,{Origin:'https://evil.example'})).status,403);
 const wrongHost=await new Promise((resolve,reject)=>{const r=httpRequest(`http://127.0.0.1:${serviceA.state().controlPort}/state`,{headers:{Host:'evil.example',Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});r.on('error',reject);r.end();});assert.equal(wrongHost,403);
 assert.equal((await control(serviceA,'/revoke',{id:inviteA.grantId},{'X-Field-Desk-Sync':''})).status,403);
 const peerB=(await command(serviceB,'/peers',{label:'Fixture A',invitation:JSON.stringify(inviteA)})).id;
 assert.equal((await control(serviceB,'/peers',{label:'Duplicate',invitation:JSON.stringify(inviteA)})).status,400);
 await command(serviceB,'/sync',{id:peerB});const inboxB=await command(serviceB,'/inbox/'+peerB);
 assert.equal(inboxB.package.records.length,1);assert(!JSON.stringify(inboxB).includes('PRIVATE'));assert(wire.every(text=>!text.includes(inviteA.secret)&&!text.includes('West deck requires inspection')));
 assert.equal(b.sharing.groups.length,1,'Received data must not auto-merge into saved study');b=previewSharedMerge(b,inboxB.package,'home').next;assert.equal(b.notes[0].name,'Keep private local note');
 b=addSharedReview(b,groupId,recordId,{revisionId,status:'Confirmed',observedAt:'2026-10-09T12:00:00Z',comment:'Inspected the west end'});
 const inviteB=(await command(serviceB,'/grants',{groupId,label:'Fixture A',recordIds:[recordId],recipientId:a.sharing.member.id})).invite;
 const peerA=(await command(serviceA,'/peers',{label:'Fixture B',invitation:JSON.stringify(inviteB)})).id;await command(serviceA,'/sync',{id:peerA});const inboxA=await command(serviceA,'/inbox/'+peerA);
 a=previewSharedMerge(a,inboxA.package,'home').next;assert.equal(reviewSummary(a.sharing.groups[0].records[0],revisionId).confirmed,1);
 assert.equal(previewSharedMerge(a,inboxA.package,'home').reviews,0);
 a=updateActive(a,s=>({...s,notes:s.notes.map(n=>n.id===fixture.id?{...n,detail:'Deck repaired; new inspection due'}:n)}));a=stageContributions(a,groupId,['note:fixture-note']);
 await command(serviceB,'/automatic',{id:peerB,enabled:true});const deadline=Date.now()+3000;let updated;
 do{await new Promise(r=>setTimeout(r,40));updated=await command(serviceB,'/inbox/'+peerB);}while(updated.package.records[0].revisions.length<2&&Date.now()<deadline);
 assert.equal(updated.package.records[0].revisions.length,2);await command(serviceB,'/automatic',{id:peerB,enabled:false});
 const merge=previewSharedMerge(b,updated.package,'home');assert.equal(merge.revisions,1);assert.equal(merge.next.sharing.groups.find(g=>g.id===groupId).selected[recordId],revisionId);
 const testIdentity=await loadSigningIdentity(directoryB);const requestId=randomUUID(),ctx=`v1:${inviteA.grantId}:${groupId}`,requestBody={operation:'pull',requestId,sentAt:Date.now()},valid=sealPeer({...requestBody,signature:signValue(testIdentity,'field-desk-pull-v1',{context:ctx,...requestBody})},inviteA.secret,'request',ctx),url=inviteA.endpoint+'/v1/pull/'+inviteA.grantId;
 // Knowing only the invitation secret is insufficient: the recipient must sign the request.
 const unsignedRequest=sealPeer(requestBody,inviteA.secret,'request',ctx);assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(unsignedRequest)})).status,404);
 const first=await fetch(url,{method:'POST',body:JSON.stringify(valid)});assert.equal(first.status,200);assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(valid)})).status,404);
 const stale=sealPeer({operation:'pull',requestId:randomUUID(),sentAt:Date.now()-300000},inviteA.secret,'request',ctx);assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(stale)})).status,404);
 assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(sealPeer({operation:'pull'},key,'request',ctx))})).status,404);
 await assert.rejects(()=>serviceB.pull(inviteA,async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'http://8.8.8.8/'}});}));
 const oldReceived=serviceB.state().peers[0].receivedAt;await command(serviceA,'/revoke',{id:inviteA.grantId});assert.equal((await control(serviceB,'/sync',{id:peerB})).status,400);assert(serviceB.state().peers[0].error);const retained=await command(serviceB,'/inbox/'+peerB);assert.equal(retained.stale,true);assert.equal(retained.receivedAt,oldReceived);assert.equal(retained.package.records[0].revisions.length,2);
 assert.equal((await fetch(url,{method:'POST',body:JSON.stringify(valid)})).status,404);
 assert.equal(JSON.parse(await readFile(path.join(directoryA,'peer-sync.json'),'utf8')).grants.length,0);
 await command(serviceB,'/forget',{id:peerB});assert.equal(serviceB.state().peers.length,0);assert.equal((await control(serviceB,'/inbox/'+peerB)).status,404);assert(b.sharing.groups.some(g=>g.id===groupId));
 await serviceB.close();serviceB=null;
 const configFile=path.join(directoryB,'peer-sync.json'),savedConfig=await readFile(configFile,'utf8'),invalidConfig=JSON.parse(savedConfig);invalidConfig.peers=[{id:randomUUID(),label:'Invalid peer',automatic:false,invite:{...inviteA,endpoint:'http://8.8.8.8:5186'}}];await writeFile(configFile,JSON.stringify(invalidConfig));
 // A new valid key claiming an existing contributor UUID cannot replace the pinned key.
 const impostor={...(await loadSigningIdentity(directoryA)),memberId:b.sharing.member.id},fakeCard=identityCard(impostor,b.sharing.member),fakeBody={...inviteB,publisherIdentity:fakeCard};delete fakeBody.signature;
 const fakeInvite={...fakeBody,signature:signValue(impostor,'field-desk-invite-v1',fakeBody)};
 const changedPin=await control(serviceA,'/peers',{label:'Impostor key',invitation:JSON.stringify(fakeInvite),verifiedFingerprint:await fingerprint(fakeCard.publicKey)});assert.equal(changedPin.status,400);assert.match((await changedPin.json()).error,/key changed/);
 await assert.rejects(()=>startPeerSync({directory:directoryB,port:0,controlPort:0,studyReader:async()=>b}),/configuration is invalid/);
 await assert.rejects(()=>readFile(path.join(directoryB,'peer-sync.lock')),e=>e.code==='ENOENT');assert.equal(await readFile(configFile,'utf8'),JSON.stringify(invalidConfig),'Invalid configuration must remain intact');await writeFile(configFile,savedConfig);
 serviceB=await startPeerSync({directory:directoryB,port:0,controlPort:0,studyReader:async()=>b});assert.equal(serviceB.state().grants.length,1,'Invitations persist across restart');
 await assert.rejects(()=>startPeerSync({directory:directoryB,port:0,controlPort:0,studyReader:async()=>b}),/Another sync/);
 console.log('Peer sync passed: two live loopback instances, selective encrypted exchange, no secret/plaintext on wire, CORS/Host guards, replay/expiry rejection, bidirectional dated review exchange, automatic polling, no automatic study writes, selected-version preservation, revocation, stale fallback, disconnect and configuration restart.');
}finally{
 await serviceA?.close();await serviceB?.close();
 for(const directory of [directoryA,directoryB]){if(!directory.startsWith(root+path.sep)||!path.basename(directory).startsWith('.local-storage-test-sync-'))throw Error('Unsafe test cleanup path.');await rm(directory,{recursive:true,force:true});}
}
