import type {SharedGroup,SharedPackage,SharedPayload,SharedRecord} from './sharing-schema';
import {reviewSummary,sharedLifecycle} from './sharing';

function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export function payloadChanges(before:SharedPayload,after:SharedPayload){
 const a=before as unknown as Record<string,unknown>,b=after as unknown as Record<string,unknown>;
 return [...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>canonical(a[key])!==canonical(b[key])).map(key=>({key,before:a[key],after:b[key]}));
}
export type ContributionChange={record:SharedRecord;status:'New'|'Updated'|'Unchanged'|'Conflict';revisions:number;reviews:number;proofs:number;reason?:string;selectedRevision?:string};
// This is an inspection aid, never authorization or a replacement for immutable merge validation.
export function packageChanges(group:SharedGroup|undefined,pkg:SharedPackage):ContributionChange[]{
 return pkg.records.map(record=>{
  const prior=group?.records.find(r=>r.id===record.id);
  const revisions=record.revisions.filter(v=>!prior?.revisions.some(old=>old.id===v.id)).length;
  const reviews=record.reviews.filter(v=>!prior?.reviews.some(old=>old.id===v.id)).length;
  const proofs=[...record.revisions,...record.reviews].filter(v=>pkg.auth?.events[record.id+':'+v.id]&&!group?.signatures[record.id+':'+v.id]).length;
  let reason:string|undefined;
  if(prior){
   if(canonical(prior.member)!==canonical(record.member))reason='Existing contributor identity differs.';
   for(const [oldEvents,events] of [[prior.revisions,record.revisions],[prior.reviews,record.reviews]] as const){
    for(const event of events){const old=oldEvents.find(v=>v.id===event.id);if(old&&canonical(old)!==canonical(event))reason='An immutable event ID has different content.';}
   }
   for(const event of [...record.revisions,...record.reviews]){const key=record.id+':'+event.id,old=group?.signatures[key],next=pkg.auth?.events[key];if(old&&next&&old.publicKey!==next.publicKey)reason='An existing event has a different signing key.';}
  }
  return {record,status:reason?'Conflict':!prior?'New':revisions||reviews||proofs?'Updated':'Unchanged',revisions,reviews,proofs,...(reason?{reason}:{}),selectedRevision:group?.selected[record.id]||prior?.revisions[0].id};
 });
}
export function needsSharedAttention(record:SharedRecord,selected:string|undefined,now=Date.now()){
 const revision=record.revisions.find(v=>v.id===selected)||record.revisions[0];
 const summary=reviewSummary(record,revision.id,now);
 return sharedLifecycle(record).withdrawn||summary.disputed>0||summary.outdated>0||summary.expired>0||record.revisions.some(v=>Date.parse(v.createdAt)>Date.parse(revision.createdAt));
}
