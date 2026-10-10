import {MAX_STUDY_BYTES,MAX_SHARED_BYTES,MAX_BULK_REVIEWS} from './sharing-limits';
export {MAX_SHARED_BYTES} from './sharing-limits';
import {documentCandidates} from './sharing-documents';
import {requireVerifiedPackage} from './sharing-auth';
import {sharedPackageSchema,sharingGroupSchema,sharedPayloadSchema,sharedReviewSchema,type SharedPackage,type SharedGroup,type SharedPayload,type SharedRecord,type SharedReview} from './sharing-schema';
import {restorePortfolio,type Portfolio} from './locations';
export type ShareCandidate={key:string;payload:SharedPayload;relations?:{key:string;kind:'evidence'|'question'|'service-plan'|'scenario'|'route'|'boundary'}[]};
const size=(v:string)=>new TextEncoder().encode(v).length;
// Canonical comparison is independent of incoming object-key order.
function canonical(v:unknown):string {if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}';return JSON.stringify(v);}
export function validateSharedStudy(p:Portfolio):Portfolio {const next=restorePortfolio(p);if(size(JSON.stringify(next))>MAX_STUDY_BYTES)throw Error('Combined study exceeds the 16 MB save limit. Share fewer records or revisions.');return next;}
export function shareCandidates(p:Portfolio):ShareCandidate[]{
 const context=p.locations.find(l=>l.id===p.activeLocationId)||p;
 const candidates:ShareCandidate[]=context.notes.map(n=>({key:'note:'+n.id,payload:{kind:'observation',name:n.name,point:[n.lat,n.lng],detail:n.detail||'',source:n.source,...(n.url?{url:n.url}:{}),...(n.date?{observedAt:n.date}:{}),...(n.confidence?{confidence:n.confidence}:{})}}));
 for(const kind of ['aor','aoi'] as const)if(context.areas[kind].length>=3)candidates.push({key:'boundary:'+kind,payload:{kind:'boundary',name:kind.toUpperCase(),points:context.areas[kind],detail:'Shared study boundary; does not replace your local boundary.'}});
 for(const r of p.routes)if(r.fromLocationId===p.activeLocationId||r.toLocationId===p.activeLocationId||(!r.fromLocationId&&!r.toLocationId))candidates.push({key:'route:'+r.id,payload:{kind:'route',name:r.name,points:r.points,detail:r.notes}});
 return [...candidates,...documentCandidates(p)];
}
export function createSharedGroup(p:Portfolio,name:string,memberName:string):Portfolio {
 const member=p.sharing.member||{id:crypto.randomUUID(),name:memberName.trim()};
 const group=sharingGroupSchema.parse({id:crypto.randomUUID(),name,locationId:p.activeLocationId,records:[],selected:{},links:{},provenance:{},signatures:{}});
 return validateSharedStudy({...p,sharing:{member:{...member,name:memberName.trim()},groups:[...p.sharing.groups,group]}});
}
export function stageContributions(p:Portfolio,groupId:string,keys:string[],correctionReason="Local content updated; compare the complete revised snapshot."):Portfolio {
 const member=p.sharing.member;if(!member)throw Error('Set your contributor name first.');
 const group=p.sharing.groups.find(g=>g.id===groupId);if(!group||group.locationId!==p.activeLocationId)throw Error('Choose a group attached to this location.');
 const candidates=shareCandidates(p),g=structuredClone(group),now=new Date().toISOString();
 // Reserve IDs before constructing references; only explicitly co-selected local items link.
 for(const key of new Set(keys))if(!g.links[key])g.links[key]=crypto.randomUUID();
 for(const key of new Set(keys)){
  const candidate=candidates.find(c=>c.key===key);if(!candidate)throw Error('Selected local content changed. Select it again.');
  const draft=structuredClone(candidate.payload);
  if('references' in draft){const relations=candidate.relations||[],included=relations.filter(r=>keys.includes(r.key)&&!!g.links[r.key]&&candidates.some(c=>c.key===r.key));draft.references=included.map(r=>({kind:r.kind,recordId:g.links[r.key]}));draft.omittedLinks=relations.length-included.length;}
  const payload=sharedPayloadSchema.parse(draft),existing=g.records.find(r=>r.id===g.links[key]);
  if(existing){
   if(existing.member.id!==member.id)throw Error('Only the origin contributor can stage a revision.');
   const last=latestSharedRevision(existing);
   if(canonical(last.payload)!==canonical(payload)||last.notice?.kind==='Withdrawn'){const revision={id:crypto.randomUUID(),createdAt:new Date(Math.max(Date.now(),Date.parse(last.createdAt)+1)).toISOString(),payload,notice:{kind:'Corrected' as const,reason:correctionReason,replacesRevisionId:last.id}};existing.revisions.push(revision);g.provenance[existing.id+":"+revision.id]={kind:"local",memberId:member.id};g.selected[existing.id]=revision.id;}
  }else{const record:SharedRecord={id:g.links[key],member:{...member},revisions:[{id:crypto.randomUUID(),createdAt:now,payload}],reviews:[]};g.records.push(record);g.provenance[record.id+":"+record.revisions[0].id]={kind:"local",memberId:member.id};g.links[key]=record.id;g.selected[record.id]=record.revisions[0].id;}
 }
 return validateSharedStudy({...p,sharing:{...p.sharing,groups:p.sharing.groups.map(x=>x.id===g.id?g:x)}});
}
export function outboundRecords(p:Portfolio,g:SharedGroup,recordIds:string[],recipientId?:string):SharedRecord[]{
 const local=p.sharing.member?.id;
 if(recipientId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipientId))throw Error('Use a contributor UUID for the recipient.');
 const allowed=(recordId:string,eventId:string,authorId:string)=>{
  const source=g.provenance[recordId+':'+eventId];
  return !!source&&((source.kind==='local'&&source.memberId===local&&authorId===local)||(source.kind==='received'&&!!recipientId&&source.sender.id===recipientId&&authorId===recipientId));
 };
 return g.records.filter(r=>recordIds.includes(r.id)).flatMap(r=>{
  if(r.member.id!==local&&r.member.id!==recipientId)return [];
  const revisions=r.revisions.filter(v=>allowed(r.id,v.id,r.member.id));if(!revisions.length)return [];
  const ids=new Set(revisions.map(v=>v.id));
  return [{...r,revisions,reviews:r.reviews.filter(v=>ids.has(v.revisionId)&&allowed(r.id,v.id,v.member.id))}];
 });
}
export function contributionProvenance(g:SharedGroup,r:SharedRecord){
 const sources=r.revisions.map(v=>g.provenance[r.id+':'+v.id]);
 if(sources.some(s=>!s))return 'Some history has unknown provenance · those events stay local';
 const received=sources.find(s=>s?.kind==='received');
 return received?.kind==='received'?'Received from '+received.sender.name+' · return to origin only':'Created locally';
}
export function makeSharedPackage(p:Portfolio,groupId:string,recordIds:string[],recipientId?:string):SharedPackage {
 const g=p.sharing.groups.find(g=>g.id===groupId),sender=p.sharing.member;if(!g||!sender)throw Error('Choose a group and set your name.');
 if(recordIds.some(id=>!g.records.some(r=>r.id===id)))throw Error('A selected contribution no longer exists.');
 const result=sharedPackageSchema.parse({format:'field-desk-shared-study',formatVersion:1,createdAt:new Date().toISOString(),sender,group:{id:g.id,name:g.name},records:outboundRecords(p,g,recordIds,recipientId)});
 if(size(JSON.stringify(result))>MAX_SHARED_BYTES)throw Error('Selected package exceeds 8 MB. Select fewer contributions.');
 return result;
}
export function parseSharedPackage(text:string):SharedPackage {
 if(size(text)>MAX_SHARED_BYTES)throw Error('Shared package exceeds 8 MB.');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Choose a valid shared-study JSON package.');}
 const parsed=sharedPackageSchema.safeParse(raw);if(!parsed.success)throw Error('Unsupported or invalid shared package. Update the app if the sender uses newer shared content; otherwise check IDs, dates, coordinates and limits. No changes applied.');return parsed.data;
}
function unionImmutable<T extends {id:string}>(existing:T[],incoming:T[]):T[]{
 const result=[...existing];for(const item of incoming){const previous=result.find(v=>v.id===item.id);if(previous&&canonical(previous)!==canonical(item))throw Error('An existing ID has different content. Import rejected; original records retained.');if(!previous)result.push(item);}return result;
}
export function previewSharedMerge(p:Portfolio,incoming:SharedPackage,locationId:string,peerId?:string,selectedIds?:string[]){
 // Validate even callers that do not pass through the file parser.
 requireVerifiedPackage(incoming);incoming=sharedPackageSchema.parse(incoming);
 if(!['home',...p.locations.map(l=>l.id)].includes(locationId))throw Error('Choose an existing local location.');
 const existing=p.sharing.groups.find(g=>g.id===incoming.group.id);
 if(existing&&existing.locationId!==locationId)throw Error('This group is already attached to another location.');
 const g:SharedGroup=structuredClone(existing||{...incoming.group,locationId,records:[],selected:{},links:{},provenance:{},signatures:{}});
 let added=0,revisions=0,reviews=0;
 const received={kind:'received' as const,sender:incoming.sender,...(peerId?{peerId}:{}),receivedAt:new Date().toISOString()};
 for(const record of incoming.records.filter(r=>!selectedIds||selectedIds.includes(r.id))){
  const prior=g.records.find(r=>r.id===record.id);
  for(const event of [...record.revisions,...record.reviews]){const key=record.id+':'+event.id;const already=prior&&[...prior.revisions,...prior.reviews].some(e=>e.id===event.id);if(!already)g.provenance[key]=received;const proof=incoming.auth?.events[key];if(proof){const previous=g.signatures[key];if(previous&&previous.publicKey!==proof.publicKey)throw Error('Signing key changed for an existing event. Import rejected.');g.signatures[key]=previous||proof;}}
  if(!prior){g.records.push(structuredClone(record));g.selected[record.id]=record.revisions[0].id;added++;revisions+=record.revisions.length;reviews+=record.reviews.length;continue;}
  if(canonical(prior.member)!==canonical(record.member))throw Error('Contributor identity changed for an existing record. Import rejected.');
  const nextRevisions=unionImmutable(prior.revisions,record.revisions),nextReviews=unionImmutable(prior.reviews,record.reviews);
  revisions+=nextRevisions.length-prior.revisions.length;reviews+=nextReviews.length-prior.reviews.length;
  prior.revisions=nextRevisions;prior.reviews=nextReviews;
 }
 const next=validateSharedStudy({...p,sharing:{...p.sharing,groups:existing?p.sharing.groups.map(x=>x.id===g.id?g:x):[...p.sharing.groups,g]}});
 return {next,added,revisions,reviews,newGroup:!existing};
}
export function addSharedReview(p:Portfolio,groupId:string,recordId:string,review:Omit<SharedReview,'id'|'member'|'createdAt'>):Portfolio {
 const {revisionId,...assessment}=review;return addSharedReviews(p,groupId,[{recordId,revisionId}],assessment);
}
export function addSharedReviews(p:Portfolio,groupId:string,targets:{recordId:string;revisionId:string}[],assessment:Omit<SharedReview,'id'|'member'|'createdAt'|'revisionId'>):Portfolio {
 const member=p.sharing.member,group=p.sharing.groups.find(g=>g.id===groupId);
 if(!member||!group)throw Error('Choose a group and set your contributor name before reviewing.');
 if(!targets.length||targets.length>MAX_BULK_REVIEWS||new Set(targets.map(t=>t.recordId)).size!==targets.length)throw Error('Select 1–100 distinct contributions for review.');
 if(assessment.reviewBy&&Date.parse(assessment.reviewBy)<Date.parse(assessment.observedAt))throw Error('Review deadline cannot precede the checked date.');
 const g={...group,records:[...group.records],provenance:{...group.provenance}};
 for(const target of targets){const index=g.records.findIndex(r=>r.id===target.recordId),record=g.records[index];if(!record?.revisions.some(v=>v.id===target.revisionId))throw Error('A selected revision is no longer available. Nothing changed.');
  const previousTime=Math.max(0,...record.reviews.filter(r=>r.member.id===member.id).map(r=>Date.parse(r.createdAt)));
  const event=sharedReviewSchema.parse({...assessment,revisionId:target.revisionId,id:crypto.randomUUID(),member,createdAt:new Date(Math.max(Date.now(),previousTime+1)).toISOString()});
  g.records[index]={...record,reviews:[...record.reviews,event]};g.provenance[record.id+':'+event.id]={kind:'local',memberId:member.id};
 }
 return validateSharedStudy({...p,sharing:{...p.sharing,groups:p.sharing.groups.map(x=>x.id===groupId?g:x)}});
}
export function reviewSummary(record:SharedRecord,revisionId:string,now=Date.now()){
 const latest=new Map<string,SharedReview>();
 for(const r of record.reviews.filter(r=>r.revisionId===revisionId)){const before=latest.get(r.member.id);if(!before||Date.parse(r.createdAt)>Date.parse(before.createdAt)||(Date.parse(r.createdAt)===Date.parse(before.createdAt)&&r.id>before.id))latest.set(r.member.id,r);}
 const events=[...latest.values()],current=events.filter(r=>!r.reviewBy||Date.parse(r.reviewBy)>=now);
 return {confirmed:current.filter(r=>r.status==='Confirmed'&&r.member.id!==record.member.id).length,disputed:current.filter(r=>r.status==='Disputed').length,outdated:current.filter(r=>r.status==='Outdated').length,expired:events.length-current.length};
}
export function sharedMapRecords(p:Portfolio){return p.sharing.groups.filter(g=>g.locationId===p.activeLocationId).flatMap(g=>g.records.filter(r=>['observation','route','boundary'].includes((r.revisions.find(v=>v.id===g.selected[r.id])||r.revisions[0]).payload.kind)).map(r=>{
 const rev=r.revisions.find(v=>v.id===g.selected[r.id])||r.revisions[0],v=rev.payload;if(v.kind!=='observation'&&v.kind!=='route'&&v.kind!=='boundary')return null;if(sharedLifecycle(r).withdrawn)return null;const point=v.kind==='observation'?v.point:v.points[0],summary=reviewSummary(r,rev.id);
 return {id:'shared:'+g.id+':'+r.id,name:v.name,lat:point[0],lng:point[1],category:'Shared contributions',source:'Shared group · '+g.name,date:v.kind==='observation'?v.observedAt:undefined,url:v.kind==='observation'?v.url:undefined,confidence:'Contributor claim; compare signing fingerprint',detail:`Contributor: ${r.member.name}\nRevision created: ${rev.createdAt}\n${summary.confirmed} other contributors confirmed · ${summary.disputed} disputed · ${summary.outdated} outdated · ${summary.expired} reviews due\n${v.detail}`,status:'Shared '+v.kind,...(v.kind==='boundary'?{geometry:{type:'Polygon' as const,coordinates:[[...v.points,v.points[0]].map(([lat,lng])=>[lng,lat])]}}:{}),sharedRoute:v.kind==='route'?v.points:undefined};
 })).filter((v):v is NonNullable<typeof v>=>v!==null);}

// Author lifecycle is independent of the recipient's chosen displayed revision.
export function latestSharedRevision(record:SharedRecord){return [...record.revisions].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id))[0];}
export function sharedLifecycle(record:SharedRecord){const latest=latestSharedRevision(record);return {latest,withdrawn:latest.notice?.kind==='Withdrawn',corrected:latest.notice?.kind==='Corrected'};}
export function withdrawSharedContribution(p:Portfolio,groupId:string,recordId:string,reason:string):Portfolio {
 const group=p.sharing.groups.find(g=>g.id===groupId),record=group?.records.find(r=>r.id===recordId),member=p.sharing.member;
 if(!group||!record||!member||record.member.id!==member.id)throw Error('Only the origin contributor can withdraw this contribution.');
 const last=latestSharedRevision(record),origin=group.provenance[record.id+':'+last.id];
 if(origin?.kind!=='local'||origin.memberId!==member.id)throw Error('Only locally originated content can be withdrawn here.');
 if(last.notice?.kind==='Withdrawn')throw Error('This contribution is already withdrawn. Stage a new corrected revision to replace it.');
 const revision={id:crypto.randomUUID(),createdAt:new Date(Math.max(Date.now(),Date.parse(last.createdAt)+1)).toISOString(),payload:structuredClone(last.payload),notice:{kind:'Withdrawn' as const,reason:reason.trim(),replacesRevisionId:last.id}};
 return validateSharedStudy({...p,sharing:{...p.sharing,groups:p.sharing.groups.map(g=>g.id===groupId?{...g,records:g.records.map(r=>r.id===recordId?{...r,revisions:[...r.revisions,revision]}:r),selected:{...g.selected,[recordId]:revision.id},provenance:{...g.provenance,[recordId+':'+revision.id]:{kind:'local',memberId:member.id}}}:g)}});
}
