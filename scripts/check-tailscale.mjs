import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {tailscaleIPv4,parseTailscaleStatus,readTailscaleStatus,requireTailscalePeer,selectTailscaleHost} from '../lib/tailscale-network.mjs';
import {startPeerSync,privateHost,peerEndpoint,pullPeer} from '../lib/peer-sync.mjs';
import {restorePortfolio,emptyContext} from '../lib/locations.ts';
import {createSharedGroup,stageContributions} from '../lib/sharing.ts';
import {fingerprint} from '../lib/sharing-auth.ts';
import {loadSigningIdentity,signValue} from '../lib/signing-identity.mjs';
const self='100.64.1.10',remote='100.127.1.20';
const fixture={BackendState:'Running',Self:{TailscaleIPs:[self,'fd7a:115c:a1e0::1'],Online:true,HostName:'PRIVATE DEVICE'},Peer:{fixture:{TailscaleIPs:[remote],Online:true,HostName:'PRIVATE PEER'}},User:{email:'PRIVATE ACCOUNT'},AuthURL:'PRIVATE AUTH URL'};
const runner=async()=>JSON.stringify(fixture),snapshot=parseTailscaleStatus(await runner());
assert.equal(tailscaleIPv4(self),true);assert.equal(tailscaleIPv4(remote),true);
for(const ip of ['100.63.255.255','100.128.0.0','100.64.256.1','100.064.0.1','8.8.8.8','127.0.0.1','100.64.1','fd7a:115c:a1e0::1'])assert.equal(tailscaleIPv4(ip),false);
assert.throws(()=>privateHost(self),'CGNAT is never implicitly allowed for LAN binding');
assert.equal(peerEndpoint('http://'+remote+':5186'),'http://'+remote+':5186');
for(const url of ['http://8.8.8.8:5186','http://100.128.0.1:5186','http://example.org:5186','http://'+remote+':5186/?secret=x','http://user:pass@'+remote+':5186'])assert.throws(()=>peerEndpoint(url));
assert(!JSON.stringify(snapshot).includes('PRIVATE'));
assert.equal(await selectTailscaleHost(undefined,runner),self);assert.equal(await selectTailscaleHost(self,runner),self);
await assert.rejects(()=>selectTailscaleHost(remote,runner),/owned/);
requireTailscalePeer(snapshot,remote);assert.throws(()=>requireTailscalePeer(snapshot,self),/this computer/);assert.throws(()=>requireTailscalePeer(snapshot,'100.65.99.99'),/not a visible/);
assert.throws(()=>requireTailscalePeer({...snapshot,peers:[{ip:remote,online:false}]},remote),/offline/);
assert.throws(()=>requireTailscalePeer({...snapshot,selfOnline:false},remote),/disconnected/);
assert.equal(parseTailscaleStatus(JSON.stringify({BackendState:'NeedsLogin',Self:null,Peer:null})).state,'NeedsLogin');
assert.equal(parseTailscaleStatus(JSON.stringify({...fixture,Peer:null})).peers.length,0);
assert.equal((await readTailscaleStatus(async()=>{const error=Error('PRIVATE executable path');error.code='ENOENT';throw error;})).state,'NotInstalled');
assert.equal((await readTailscaleStatus(async()=>'{malformed')).state,'Unavailable');
assert.throws(()=>parseTailscaleStatus(' '.repeat(2*1024*1024+1)),/Invalid/);
const root=await mkdtemp(path.join(tmpdir(),'field-desk-tailscale-')),aDir=path.join(root,'a'),bDir=path.join(root,'b');let aService,bService;
let a=createSharedGroup(restorePortfolio({...emptyContext(),notes:[{id:'fixture',name:'Synthetic bridge',lat:40,lng:-105,category:'Observation',source:'Synthetic inspection',detail:'Fixture condition'}]}),'Fixture remote group','Fixture Sam');a=stageContributions(a,a.sharing.groups[0].id,['note:fixture']);const b=createSharedGroup(restorePortfolio(emptyContext()),'Private fixture group','Fixture John');
async function call(service,route,body){const response=await fetch(`http://127.0.0.1:${service.state().controlPort}${route}`,{method:'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
async function command(service,route,body){const r=await call(service,route,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
try{
 // Real signed exchange over loopback; only the simulated overlay route is redirected by this test fetcher.
 aService=await startPeerSync({directory:aDir,port:0,controlPort:0,studyReader:async()=>a});bService=await startPeerSync({directory:bDir,port:0,controlPort:0,studyReader:async()=>b,tailscaleRunner:runner});
 const sender=aService.state().identity,recipient=bService.state().identity,g=a.sharing.groups[0],base=(await command(aService,'/grants',{groupId:g.id,label:'Fixture recipient',recordIds:[g.records[0].id],recipientId:recipient.member.id,recipientIdentity:recipient,verifiedFingerprint:await fingerprint(recipient.publicKey)})).invite;
 const signedRemote={...base,endpoint:`http://${remote}:5186`};delete signedRemote.signature;signedRemote.signature=signValue(await loadSigningIdentity(aDir),'field-desk-invite-v1',signedRemote);
 let requests=0;const transport=(url,options)=>{requests++;assert.equal(new URL(url).hostname,remote);return fetch(url.replace(signedRemote.endpoint,base.endpoint),options);};
 const key=await loadSigningIdentity(bDir);
 await assert.rejects(()=>pullPeer(signedRemote,transport,key),/--tailscale/);assert.equal(requests,0);
 await assert.rejects(()=>pullPeer(signedRemote,transport,key,async ip=>requireTailscalePeer({...snapshot,peers:[]},ip)),/visible/);assert.equal(requests,0);
 const pkg=await pullPeer(signedRemote,transport,key,async ip=>requireTailscalePeer(snapshot,ip));assert.equal(pkg.records.length,1);assert.equal(requests,1);
 const peerId=(await command(bService,'/peers',{label:'Fixture remote publisher',invitation:JSON.stringify(signedRemote),verifiedFingerprint:await fingerprint(sender.publicKey)})).id;
 let result=await command(bService,'/diagnostics',{id:peerId});assert.equal(result.ok,false);assert.match(result.message,/--tailscale/);assert.equal(bService.state().inbox.length,0);
 const network=await command(bService,'/network',{});assert.equal(network.enabled,false);assert.equal(network.peers[0].online,true);assert(!JSON.stringify(network).includes('PRIVATE'));assert(!JSON.stringify(network).includes(base.secret));
 // Successful application test checks signed traffic without adding an inbox entry or saving.
 const localPeer=(await command(bService,'/peers',{label:'Fixture loopback publisher',invitation:JSON.stringify(base),verifiedFingerprint:await fingerprint(sender.publicKey)})).id;
 result=await command(bService,'/diagnostics',{id:localPeer});assert.equal(result.ok,true);assert.equal(bService.state().inbox.length,0);
 await command(aService,'/revoke',{id:base.grantId});result=await command(bService,'/diagnostics',{id:localPeer});assert.equal(result.ok,false);assert(!result.message.includes(base.secret));
 await assert.rejects(()=>startPeerSync({directory:path.join(root,'bad-bind'),host:remote,tailscale:true,port:0,controlPort:0,tailscaleRunner:runner,studyReader:async()=>b}),/owned/);
 console.log('Tailscale passed: exact overlay range, owned binding, login/malformed/missing client, visible-online peer guards, no request on rejection, sanitized status, real signed exchange through a simulated overlay route, default-mode rejection, authenticated diagnostics without study/inbox writes, revocation and restricted endpoints.');
}finally{await bService?.close();await aService?.close();if(!root.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(root).startsWith('field-desk-tailscale-'))throw Error('Unexpected test cleanup path');await rm(root,{recursive:true,force:true});}
