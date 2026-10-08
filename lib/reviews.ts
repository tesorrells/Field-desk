import type {Portfolio,LocationContext} from './locations';
import {localDate,type Evidence} from './collection';
import {planFlags,type ResourceSnapshot} from './dependencies';
import {scenarioFlags,scenarioMissingLinks} from './scenarios';
import {reviewEventSchema,type ReviewTarget,type ReviewEvent} from './review-schema';
export type CurrentRecord={id:string;name:string;source:string;url?:string;date?:string;detail?:string;updatedDate?:string;lat?:number;lng?:number;stale?:boolean;status?:string};
export type ReviewReason={kind:'Due'|'Upcoming'|'Unscheduled'|'Unresolved'|'Gap'|'Stale evidence'|'Undated evidence'|'Source changed'|'Stale source';text:string;before?:string;after?:string};
export type ReviewItem={target:ReviewTarget;key:string;title:string;locationName:string;due:string;reasons:ReviewReason[];lastReview?:ReviewEvent;observed:ReviewEvent['observed'];matched:number;comparable:number;sourceCheck:boolean};
export function reviewKey(t:ReviewTarget){return JSON.stringify([t.type,t.locationId,t.parentId,t.itemId]);}
export function addDays(day:string,days:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function dateAge(value:string,today:string):number|null {if(!value)return null;const time=Date.parse(value);return Number.isFinite(time)?Math.floor((Date.parse(today+'T12:00:00Z')-time)/86400000):null;}
// A compact change token, not an authenticity check. Retrieval/capture times are excluded.
function fingerprint(v:unknown){const s=JSON.stringify(v);let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return `${s.length}:${a>>>0}:${b>>>0}`;}
const limits:Partial<Record<keyof CurrentRecord,number>>={name:300,source:200,url:2000,date:100,detail:2000,updatedDate:100,status:200};
const fields=['name','source','url','date','detail','updatedDate','status','lat','lng'] as const;
function evidenceRecord(e:Evidence):CurrentRecord{return {id:e.recordId,name:e.title,source:e.source,url:e.url,date:e.date,detail:e.detail,status:e.status};}
function savedValues(e:CurrentRecord,current:CurrentRecord){return fields.filter(k=>e[k]!==undefined).map(k=>({field:k,before:String(e[k]??'').trim(),after:String(current[k]??'').slice(0,limits[k]??10000).trim()}));}
export function reviewQueue(p:Portfolio,records:CurrentRecord[],whole=false,today=localDate()):ReviewItem[]{
 const contexts=[{id:'home',name:'Home',context:p},...p.locations.map(l=>({id:l.id,name:l.name,context:l}))],queue:ReviewItem[]=[];
 const recordIndex=new Map<string,CurrentRecord[]>();for(const r of records){const k=JSON.stringify([r.source,r.id]);recordIndex.set(k,[...(recordIndex.get(k)||[]),r]);}
 const latest=new Map<string,ReviewEvent>();for(const e of p.reviews.history){const key=reviewKey(e.target),prev=latest.get(key);if(!prev||e.recordedAt>=prev.recordedAt)latest.set(key,e);}
 function item(target:ReviewTarget,title:string,locationName:string,due:string,snapshots:{key:string;record:CurrentRecord;compare:boolean}[],extra:ReviewReason[]):ReviewItem{
  const key=reviewKey(target),lastReview=latest.get(key),reasons=[...extra],observed:ReviewEvent['observed']=[],sourceCheck=target.locationId===p.activeLocationId;let matched=0,comparable=0;
  if(target.type==='Route')due=lastReview?.nextReview||'';
  if(!due)reasons.push({kind:'Unscheduled',text:'No next review date set.'});else if(due<=today)reasons.push({kind:'Due',text:`Review due ${due}.`});else if(due<=addDays(today,p.reviews.settings.upcomingDays))reasons.push({kind:'Upcoming',text:`Review scheduled ${due}.`});
  for(const s of snapshots){const age=dateAge(s.record.date||'',today);if(age===null)reasons.push({kind:'Undated evidence',text:`${s.record.name}: source/observation date is unavailable. Capture time is not a source date.`});else if(age>=p.reviews.settings.evidenceAgeDays)reasons.push({kind:'Stale evidence',text:`${s.record.name}: dated ${s.record.date}, approximately ${age} days old (review threshold ${p.reviews.settings.evidenceAgeDays} days).`});
   if(!s.compare||!s.record.id)continue;comparable++;if(!sourceCheck)continue;
   // Exact ID and source match only; an absent record is never a deletion or an all-clear.
   const candidates=recordIndex.get(JSON.stringify([s.record.source,s.record.id]))||[];if(candidates.length!==1)continue;const current=candidates[0];matched++;
   if(current.stale)reasons.push({kind:'Stale source',text:`${s.record.name}: the loaded comparison record is stale; refresh or check the original source.`});
   const pairs=savedValues(s.record,current),token=fingerprint(pairs);observed.push({key:s.key,fingerprint:token});const changed=pairs.filter(v=>v.before!==v.after);
   if(changed.length&&!lastReview?.observed.some(o=>o.key===s.key&&o.fingerprint===token))reasons.push({kind:'Source changed',text:`${s.record.name}: ${changed.map(v=>v.field).join(', ')} changed since evidence capture.`,before:changed.map(v=>`${v.field}: ${v.before||'(not supplied)'}`).join('\n'),after:changed.map(v=>`${v.field}: ${v.after||'(not supplied)'}`).join('\n')});
  }
  return {target,key,title,locationName,due,reasons,lastReview,observed,matched,comparable,sourceCheck};
 }
 for(const c of contexts){if(!whole&&c.id!==p.activeLocationId)continue;const context:LocationContext=c.context;
  for(const q of context.collection.questions){const evidence=q.evidence.map(e=>({key:e.id,record:evidenceRecord(e),compare:e.kind!=='Link'}));const reasons:ReviewReason[]=[];if(q.status!=='Answered'&&q.neededBy&&q.neededBy<today)reasons.push({kind:'Due',text:`Collection overdue since ${q.neededBy}.`});if(q.status!=='Answered')reasons.push({kind:'Unresolved',text:`Question is ${q.status.toLowerCase()}${q.neededBy?`; collection needed by ${q.neededBy}`:''}.`});if(!q.evidence.length)reasons.push({kind:'Gap',text:'No captured evidence.'});queue.push(item({type:'Question',locationId:c.id,itemId:q.id,parentId:''},q.question,c.name,q.reviewOn,evidence,reasons));
   for(const r of q.requirements){if(r.status==='Retired')continue;const rr:ReviewReason[]=[];if(r.status!=='Answered'&&r.neededBy&&r.neededBy<today)rr.push({kind:'Due',text:`Collection overdue since ${r.neededBy}.`});if(r.status!=='Answered')rr.push({kind:'Unresolved',text:`Requirement is ${r.status.toLowerCase()}${r.neededBy?`; needed by ${r.neededBy}`:''}.`});if(!r.source.trim()||(!r.location.trim()&&!r.naiIds.length))rr.push({kind:'Gap',text:'Source or collection location is missing.'});queue.push(item({type:'Requirement',locationId:c.id,itemId:r.id,parentId:q.id},r.task,c.name,r.reviewOn,evidence.filter(e=>r.evidenceIds.includes(e.key)),rr));}
  }
  for(const s of context.scenarios){if(s.status==='Retired')continue;const reasons:ReviewReason[]=(scenarioFlags(s,today).gaps||scenarioMissingLinks(s,{questions:context.collection.questions,areas:context.nais,services:context.servicePlans,routes:p.routes}).length>0)?[{kind:'Gap',text:'Scenario has incomplete assessment, evidence, triggers or actions. Open the plan to resolve its gaps.'}]:[];queue.push(item({type:'Scenario',locationId:c.id,itemId:s.id,parentId:''},s.title,c.name,s.reviewOn,s.evidence.map(e=>({key:e.id,record:evidenceRecord(e),compare:e.kind!=='Link'})),reasons));}
  for(const s of context.servicePlans){const snapshots=[...(s.primary?[{key:'primary',record:s.primary,compare:true}]:[]),...s.alternatives.filter(a=>a.resource).map(a=>({key:a.id,record:a.resource as ResourceSnapshot,compare:true}))];const reasons:ReviewReason[]=planFlags(s,today).gap?[{kind:'Gap',text:'Dependencies, backup verification or switch triggers need attention.'}]:[];for(const v of [...s.dependencies,...s.alternatives])if(v.verifiedOn&&(dateAge(v.verifiedOn,today)??0)>=p.reviews.settings.evidenceAgeDays)reasons.push({kind:'Stale evidence',text:`${v.name}: verification dated ${v.verifiedOn} needs another check.`});queue.push(item({type:'Service',locationId:c.id,itemId:s.id,parentId:''},s.name,c.name,s.reviewOn,snapshots,reasons));}
 }
 const active=contexts.find(c=>c.id===p.activeLocationId)!;
 for(const r of p.routes){if(!whole&&r.fromLocationId!==p.activeLocationId&&r.toLocationId!==p.activeLocationId&&(r.fromLocationId||r.toLocationId)&&!active.context.scenarios.some(s=>s.routeIds.includes(r.id)))continue;const reasons:ReviewReason[]=[];if(!r.corridor)reasons.push({kind:'Gap',text:'No saved corridor collection. Open the route to check its sources.'});else {if((dateAge(r.corridor.collectedAt,today)??0)>=p.reviews.settings.evidenceAgeDays)reasons.push({kind:'Stale evidence',text:`Corridor collected ${r.corridor.collectedAt}; refresh source coverage.`});if(r.corridor.sources.some(s=>s.failed||s.stale||s.unsupported||s.complete<s.total))reasons.push({kind:'Gap',text:'Saved corridor coverage is incomplete, stale or unsupported.'});}queue.push(item({type:'Route',locationId:'__routes__',itemId:r.id,parentId:''},r.name,'Shared routes','',[],reasons));}
 const weight=(i:ReviewItem)=>i.reasons.some(r=>r.kind==='Source changed')?0:i.reasons.some(r=>r.kind==='Due')?1:i.reasons.some(r=>r.kind==='Stale evidence'||r.kind==='Stale source')?2:i.reasons.length?3:4;
 return queue.sort((a,b)=>weight(a)-weight(b)||(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
}
export function recordReview(p:Portfolio,item:ReviewItem,note:string,nextReview:string,now=new Date()):Portfolio{
 if(p.reviews.history.length>=300)throw Error('Review history is full (300 entries). Export your study before removing old entries.');
 if(nextReview<=localDate(now))throw Error('Choose a next review date after today.');
 const event=reviewEventSchema.parse({id:crypto.randomUUID(),target:item.target,title:item.title,recordedAt:now.toISOString(),nextReview,note,observed:item.observed});
 const t=item.target;let found=false;
 function apply(c:LocationContext):LocationContext {if(t.type==='Question'||t.type==='Requirement')return {...c,collection:{...c.collection,questions:c.collection.questions.map(q=>{if(t.type==='Question'&&q.id===t.itemId){found=true;return {...q,reviewOn:nextReview};}if(t.type==='Requirement'&&q.id===t.parentId)return {...q,requirements:q.requirements.map(r=>{if(r.id!==t.itemId)return r;found=true;return {...r,reviewOn:nextReview};})};return q;})}};if(t.type==='Scenario')return {...c,scenarios:c.scenarios.map(s=>{if(s.id!==t.itemId)return s;found=true;return {...s,reviewOn:nextReview};})};return {...c,servicePlans:c.servicePlans.map(s=>{if(s.id!==t.itemId)return s;found=true;return {...s,reviewOn:nextReview};})};}
 let result=p;if(t.type==='Route')found=p.routes.some(r=>r.id===t.itemId);else if(t.locationId==='home')result={...p,...apply(p)};else result={...p,locations:p.locations.map(l=>l.id===t.locationId?{...l,...apply(l)}:l)};
 if(!found)throw Error('This item no longer exists. Refresh the review queue.');return {...result,reviews:{...p.reviews,history:[...p.reviews.history,event]}};
}
