import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadSigningIdentity} from '../lib/signing-identity.mjs';
import {LEGACY_CAPABILITIES} from '../lib/peer-capabilities.ts';
import {startPeerSync,pullPeer} from '../lib/peer-sync.mjs';
import {createSharedGroup,stageContributions,withdrawSharedContribution,previewSharedMerge,makeSharedPackage} from '../lib/sharing.ts';
import {emptyContext,restorePortfolio} from '../lib/locations.ts';
import {fingerprint,verifySignedPackage} from '../lib/sharing-auth.ts';
const note=(id,name)=>({id,name,lat:40,lng:-105,category:'Field',source:'Fixture',detail:'Synthetic scope'});
let a=createSharedGroup(restorePortfolio({...emptyContext(),notes:[note('one','Selected bridge'),note('two','Unselected shelter')]}),'Work fixture','John');
const gid=a.sharing.groups[0].id;a=stageContributions(a,gid,['note:one','note:two']);
const [one,two]=a.sharing.groups[0].records.map(r=>r.id);
let b=createSharedGroup(restorePortfolio(emptyContext()),'Private fixture','Sam');
const root=await mkdtemp(path.join(tmpdir(),'field-desk-permissions-'));let sa,sb;
async function control(s,route,body){const response=await fetch(`http://127.0.0.1:${s.state().controlPort}${route}`,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:5173','X-Field-Desk-Sync':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
async function command(s,route,body){const result=await control(s,route,body);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
try{
 sa=await startPeerSync({directory:path.join(root,'a'),port:0,controlPort:0,studyReader:async()=>a});
 sb=await startPeerSync({directory:path.join(root,'b'),port:0,controlPort:0,studyReader:async()=>b});
 const card=sb.state().identity,recipientKey=await loadSigningIdentity(path.join(root,'b'));
 const grant=await command(sa,'/grants',{groupId:gid,label:'Sam',recordIds:[one],recipientId:b.sharing.member.id,recipientIdentity:card,verifiedFingerprint:await fingerprint(card.publicKey)});
 const view=await command(sa,'/permissions'),contact=view.contacts[0];
 assert.equal(contact.incoming.length,0);assert.equal(contact.outgoing.length,1);
 assert.deepEqual(contact.outgoing[0].records.map(r=>r.id),[one]);assert.deepEqual(contact.outgoing[0].eligible.map(r=>r.id),[one,two]);
 assert(!JSON.stringify(view).includes(grant.invite.secret),'Local permissions view excludes transport secrets');
 const peer=(await command(sb,'/peers',{label:'John',invitation:JSON.stringify(grant.invite),verifiedFingerprint:await fingerprint(grant.invite.publisherIdentity.publicKey)})).id;
 await command(sb,'/sync',{id:peer});
 const incoming=(await command(sb,'/permissions')).contacts[0].incoming[0];assert.equal(incoming.scopeKnown,false);assert.equal(incoming.records.length,1);
 const preview=await command(sa,'/scope/preview',{id:grant.invite.grantId,recordIds:[two]});
 await verifySignedPackage(preview.package);assert.deepEqual(preview.added,[two]);assert.deepEqual(preview.removed,[one]);
 assert.equal(sa.state().grants[0].id,grant.invite.grantId,'Preview cannot alter sharing');
 const before=a;a={...a,sections:{Terrain:'A different saved study'}};
 assert.equal((await control(sa,'/scope/replace',{id:grant.invite.grantId,recordIds:[two],previewHash:preview.hash})).status,400);
 assert.equal(sa.state().grants[0].id,grant.invite.grantId,'Stale replacement preserves original grant');a=before;
 const replaced=await command(sa,'/scope/replace',{id:grant.invite.grantId,recordIds:[two],previewHash:preview.hash});
 assert.notEqual(replaced.invite.secret,grant.invite.secret);assert.notEqual(replaced.invite.grantId,grant.invite.grantId);assert.equal(sa.state().grants.length,1);
 await assert.rejects(()=>sb.pull(grant.invite),/revoked|unavailable/);
 const next=await sb.pull(replaced.invite);assert.deepEqual(next.records.map(r=>r.id),[two]);
 assert.equal((await control(sa,'/scope/replace',{id:grant.invite.grantId,recordIds:[one],previewHash:preview.hash})).status,400);
 a=withdrawSharedContribution(a,gid,two,'Synthetic inspection invalidated the location');
 await assert.rejects(()=>pullPeer(replaced.invite,fetch,recipientKey,undefined,LEGACY_CAPABILITIES),/update required.*corrections/i);
 assert.equal((await sb.pull(replaced.invite)).records[0].revisions.at(-1).notice.kind,'Withdrawn');
 // John cannot add received Tim content to Sam's scope.
 let tim=createSharedGroup(restorePortfolio({...emptyContext(),notes:[note('third','Tim-only note')]}),'Third-party fixture','Tim');tim=stageContributions(tim,tim.sharing.groups[0].id,['note:third']);
 const third=tim.sharing.groups[0].records[0];const imported=makeSharedPackage(tim,tim.sharing.groups[0].id,[third.id]);
 // A new group cannot be substituted through scope replacement.
 a=previewSharedMerge(a,imported,'home').next;
 assert.equal((await control(sa,'/scope/preview',{id:replaced.invite.grantId,recordIds:[third.id]})).status,400);
 await command(sa,'/contacts/block',{id:b.sharing.member.id});
 assert.equal((await control(sa,'/scope/replace',{id:replaced.invite.grantId,recordIds:[one],previewHash:preview.hash})).status,400);
 assert.equal(sa.state().grants.length,0);
 console.log('Peer permissions passed: exact saved outgoing scope, incoming snapshot caveat, no secrets, explicit signed preview, additions/removals, stale study rejection, atomic secret/grant replacement, old-invite revocation, blocked contacts, third-party exclusion and authenticated unsupported-notice rejection.');
}finally{
 await sa?.close();await sb?.close();
 if(!root.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(root).startsWith('field-desk-permissions-'))throw Error('Unexpected fixture cleanup target');
 await rm(root,{recursive:true,force:true});
}
