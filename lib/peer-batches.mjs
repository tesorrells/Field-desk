// Node-only record batching. Hashes are maintained per direct connection, never across contacts.
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {outboundRecords} from './sharing.ts';
import {signSavedPackage} from './signing-identity.mjs';
import {canonical} from './sharing-auth.ts';
import {MAX_SHARED_BYTES,MAX_GROUP_RECORDS} from './sharing-limits.ts';
export const knownRecordsSchema=z.array(z.object({id:z.string().uuid(),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(MAX_GROUP_RECORDS).refine(v=>new Set(v.map(r=>r.id)).size===v.length);
export function sharedRecordDigest(record){return createHash('sha256').update(canonical({...record,revisions:[...record.revisions].sort((a,b)=>a.id.localeCompare(b.id)),reviews:[...record.reviews].sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');}
export function chooseRecordBatch(records,known){
 const hashes=new Map(knownRecordsSchema.parse(known).map(r=>[r.id,r.digest]));
 const changed=records.filter(r=>hashes.get(r.id)!==sharedRecordDigest(r)).sort((a,b)=>a.id.localeCompare(b.id));
 const chosen=[];let bytes=3000;
 for(const record of changed){
  // Include full history. Reserve actual serialized proof-shape overhead for every event.
  const proof={publicKey:'A'.repeat(59),signedAt:'2026-10-10T00:00:00.000Z',signature:'A'.repeat(86)};
  const cost=Buffer.byteLength(JSON.stringify(record))+[...record.revisions,...record.reviews].reduce((n,e)=>n+Buffer.byteLength(JSON.stringify({[record.id+':'+e.id]:proof})),0);
  if(cost+3000>MAX_SHARED_BYTES)throw Error('A contribution with its full signed history exceeds the 8 MB transfer limit. History was not trimmed. Create a smaller new contribution deliberately.');
  if(chosen.length>=100||bytes+cost>MAX_SHARED_BYTES)break;
  chosen.push(record);bytes+=cost;
 }
 return {recordIds:chosen.map(r=>r.id),exchange:{total:records.length,remaining:changed.length-chosen.length}};
}

export async function signScopeBatches(portfolio,groupId,recordIds,recipientId,identity){
 const group=portfolio.sharing.groups.find(g=>g.id===groupId);if(!group||recordIds.some(id=>!group.records.some(r=>r.id===id)))throw Error('Saved sharing scope is unavailable.');
 const records=outboundRecords(portfolio,group,recordIds,recipientId),known=[],packages=[];
 do{const batch=chooseRecordBatch(records,known),pkg=await signSavedPackage(portfolio,groupId,batch.recordIds,recipientId,identity);packages.push(pkg);known.push(...pkg.records.map(r=>({id:r.id,digest:sharedRecordDigest(r)})));if(!batch.exchange.remaining)break;}while(packages.length<MAX_GROUP_RECORDS);
 if(known.length!==records.length)throw Error('Complete scope could not be previewed. Nothing published.');return {packages,records};
}
