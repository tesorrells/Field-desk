import type {Portfolio} from './locations';
import {outboundRecords,sharedLifecycle} from './sharing';
export type ScopeRecord={id:string;name:string;kind:string;withdrawn:boolean;missing:boolean};
export type PermissionsView={contacts:{id:string;label:string;status:string;outgoing:{id:string;groupId:string;groupName:string;createdAt:string;records:ScopeRecord[];eligible:ScopeRecord[];renewal:boolean}[];incoming:{id:string;groupId:string;groupName:string;receivedAt:string|null;records:ScopeRecord[];scopeKnown:false}[]}[];checkedAt:string};
const summary=(record:any):ScopeRecord=>({id:record.id,name:record.revisions[0].payload.name,kind:record.revisions[0].payload.kind,withdrawn:sharedLifecycle(record).withdrawn,missing:false});
// Local control view only. No secrets, public keys, private addresses or unrelated study text.
export function permissionsView(portfolio:Portfolio,config:any,inboxes:{peerId:string;receivedAt:string;package:any}[]):PermissionsView {
 return {checkedAt:new Date().toISOString(),contacts:config.contacts.map((contact:any)=>({id:contact.id,label:contact.label,status:contact.status,
 outgoing:config.grants.filter((g:any)=>g.recipientId===contact.id).map((grant:any)=>{
  const group=portfolio.sharing.groups.find(g=>g.id===grant.groupId);
  return {id:grant.id,groupId:grant.groupId,groupName:group?.name||'Saved group unavailable',createdAt:grant.createdAt,renewal:grant.policy!=='pairwise-signed-v1',
   records:grant.recordIds.map((id:string)=>{const record=group?.records.find(r=>r.id===id);return record?summary(record):{id,name:'Saved contribution unavailable',kind:'Unknown',withdrawn:false,missing:true};}),
   eligible:group?outboundRecords(portfolio,group,group.records.map(r=>r.id),contact.id).map(summary):[]};
 }),
 incoming:config.peers.filter((p:any)=>p.invite.publisher?.id===contact.id).map((peer:any)=>{
  const entry=inboxes.filter(e=>e.peerId===peer.id).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))[0];
  return {id:peer.id,groupId:peer.invite.groupId,groupName:peer.invite.groupName,receivedAt:entry?.receivedAt||null,records:entry?.package.records.map(summary)||[],scopeKnown:false as const};
 })}))};
}
