import type {Portfolio} from './locations';
import type {ShareCandidate} from './sharing';
import {sharedPayloadSchema} from './sharing-schema';
const omit=(value:object,keys:string[])=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));
export function documentCandidates(p:Portfolio):ShareCandidate[]{
 const context=p.locations.find(l=>l.id===p.activeLocationId)||p,result:ShareCandidate[]=[];
 const base={references:[],omittedLinks:0};
 for(const [section,text] of Object.entries(context.sections))if(text.trim())result.push({key:'finding:'+section,payload:sharedPayloadSchema.parse({...base,kind:'finding',name:section,detail:text,content:{section}})});
 const evidence=(key:string,e:any)=>result.push({key,payload:sharedPayloadSchema.parse({...base,kind:'evidence',name:e.title,detail:e.detail,content:omit(e,['id','recordId'])})});
 for(const q of context.collection.questions){
  const related=q.evidence.map(e=>({key:`evidence:question:${q.id}:${e.id}`,kind:'evidence' as const}));
  for(const e of q.evidence)evidence(`evidence:question:${q.id}:${e.id}`,e);
  result.push({key:'question:'+q.id,relations:[...related,...q.naiIds.map(id=>({key:'nai:'+id,kind:'boundary' as const}))],payload:sharedPayloadSchema.parse({...base,kind:'question',name:q.question,detail:q.assessment,content:{...omit(q,['id','naiIds','evidence','requirements']),requirements:q.requirements.map(r=>omit(r,['id','naiIds','evidenceIds']))}})});
 }
 const resource=(r:any)=>r?omit(r,['id']):null;
 for(const plan of context.servicePlans)result.push({key:'service-plan:'+plan.id,relations:plan.questionIds.map(id=>({key:'question:'+id,kind:'question' as const})),payload:sharedPayloadSchema.parse({...base,kind:'service-plan',name:plan.name,detail:plan.notes,content:{...omit(plan,['id','questionIds','primary','dependencies','alternatives']),primary:resource(plan.primary),dependencies:plan.dependencies.map(d=>omit(d,['id'])),alternatives:plan.alternatives.map(a=>({...omit(a,['id','resource']),resource:resource(a.resource)}))}})});
 for(const s of context.scenarios){
  for(const e of s.evidence)evidence(`evidence:scenario:${s.id}:${e.id}`,e);
  const relations=[...s.evidence.map(e=>({key:`evidence:scenario:${s.id}:${e.id}`,kind:'evidence' as const})),...s.questionIds.map(id=>({key:'question:'+id,kind:'question' as const})),...s.servicePlanIds.map(id=>({key:'service-plan:'+id,kind:'service-plan' as const})),...s.routeIds.map(id=>({key:'route:'+id,kind:'route' as const})),...s.naiIds.map(id=>({key:'nai:'+id,kind:'boundary' as const}))];
  result.push({key:'scenario:'+s.id,relations,payload:sharedPayloadSchema.parse({...base,kind:'scenario',name:s.title,detail:s.description,omittedHistory:s.history.length,content:{...omit(s,['id','questionIds','naiIds','servicePlanIds','routeIds','evidence','history','indicators','actions','exercises']),indicators:s.indicators.map(i=>omit(i,['id','evidenceIds'])),actions:s.actions.map(a=>omit(a,['id'])),exercises:s.exercises.map(e=>omit(e,['id']))}})});
 }
 return result.map(c=>({...c,payload: {...c.payload,omittedLinks:c.relations?.length||0}}));
}
