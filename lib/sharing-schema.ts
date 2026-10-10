import {MAX_SHARED_GROUPS,MAX_GROUP_RECORDS,MAX_RECORD_REVISIONS,MAX_RECORD_REVIEWS} from './sharing-limits';
import {sharedDocumentShapes} from './shared-documents';
import {canonical,eventProofSchema,packageAuthSchema} from './sharing-auth';
import {z} from 'zod';
import {pointSchema} from './location-core';

const id=z.string().uuid();
const date=z.string().datetime({offset:true});
export const memberSchema=z.object({id,name:z.string().trim().min(1).max(100)}).strict();
const url=z.string().max(2000).refine(v=>!v||/^https?:\/\//i.test(v),'Use an HTTP or HTTPS source link');
export const sharedPayloadSchema=z.discriminatedUnion('kind',[
 ...sharedDocumentShapes,
 z.object({kind:z.literal('observation'),name:z.string().trim().min(1).max(160),point:pointSchema,detail:z.string().max(20000),source:z.string().max(200),url:url.optional(),observedAt:z.string().max(100).optional(),confidence:z.string().max(100).optional()}).strict(),
 z.object({kind:z.literal('route'),name:z.string().trim().min(1).max(160),points:z.array(pointSchema).min(2).max(6000),detail:z.string().max(20000)}).strict(),
 z.object({kind:z.literal('boundary'),name:z.string().trim().min(1).max(160),points:z.array(pointSchema).min(3).max(200),detail:z.string().max(20000)}).strict(),
]);
export const sharedRevisionSchema=z.object({id,createdAt:date,payload:sharedPayloadSchema,notice:z.object({kind:z.enum(['Corrected','Withdrawn']),reason:z.string().trim().min(1).max(2000),replacesRevisionId:id}).strict().optional()}).strict();
export const sharedReviewSchema=z.object({id,revisionId:id,member:memberSchema,status:z.enum(['Confirmed','Disputed','Outdated']),observedAt:date,createdAt:date,reviewBy:date.optional(),comment:z.string().trim().min(1).max(2000)}).strict();
export const sharedRecordSchema=z.object({id,member:memberSchema,revisions:z.array(sharedRevisionSchema).min(1).max(MAX_RECORD_REVISIONS),reviews:z.array(sharedReviewSchema).max(MAX_RECORD_REVIEWS)}).strict().superRefine((r,ctx)=>{
 const ids=new Set(r.revisions.map(v=>v.id));
 for(const revision of r.revisions){if(revision.notice){const prior=r.revisions.find(v=>v.id===revision.notice!.replacesRevisionId);if(!prior||prior.id===revision.id||Date.parse(prior.createdAt)>=Date.parse(revision.createdAt))ctx.addIssue({code:'custom',message:'A correction or withdrawal must reference an earlier revision'});if(revision.notice.kind==='Withdrawn'&&prior&&canonical(revision.payload)!==canonical(prior.payload))ctx.addIssue({code:'custom',message:'Withdrawal must preserve the withdrawn content'});}}
 if(ids.size!==r.revisions.length||new Set(r.reviews.map(v=>v.id)).size!==r.reviews.length||r.reviews.some(v=>!ids.has(v.revisionId))||r.revisions.some(v=>v.payload.kind!==r.revisions[0].payload.kind))ctx.addIssue({code:'custom',message:'Duplicate IDs, missing review revision, or mismatched record types'});
});
export const sharedPackageSchema=z.object({format:z.literal('field-desk-shared-study'),formatVersion:z.union([z.literal(1),z.literal(2)]),auth:packageAuthSchema.optional(),exchange:z.object({total:z.number().int().min(0).max(MAX_GROUP_RECORDS),remaining:z.number().int().min(0).max(MAX_GROUP_RECORDS)}).strict().optional(),createdAt:date,sender:memberSchema,group:z.object({id,name:z.string().trim().min(1).max(160)}).strict(),records:z.array(sharedRecordSchema).max(MAX_GROUP_RECORDS)}).strict().superRefine((v,ctx)=>{
 if(v.exchange&&(v.formatVersion!==2||v.exchange.total<v.records.length||v.exchange.remaining>v.exchange.total-v.records.length))ctx.addIssue({code:'custom',message:'Invalid signed batch metadata'});
 if((v.formatVersion===2)!==!!v.auth)ctx.addIssue({code:'custom',message:'Signed format requires authentication metadata'});
 if(new Set(v.records.map(r=>r.id)).size!==v.records.length)ctx.addIssue({code:'custom',message:'Duplicate shared record IDs'});
});
// Local bookkeeping is never accepted from a wire package.
export const eventSourceSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('local'),memberId:id}).strict(),
 z.object({kind:z.literal('received'),sender:memberSchema,peerId:id.optional(),receivedAt:date}).strict(),
]);
export type EventSource=z.infer<typeof eventSourceSchema>;
export const sharingGroupSchema=z.object({id,name:z.string().trim().min(1).max(160),locationId:z.string().min(1).max(100),records:z.array(sharedRecordSchema).max(MAX_GROUP_RECORDS),selected:z.record(id).default({}),links:z.record(id).default({}),provenance:z.record(eventSourceSchema).default({}),signatures:z.record(eventProofSchema).default({})}).strict().superRefine((g,ctx)=>{
 const records=new Map(g.records.map(r=>[r.id,r]));
 const eventKeys=new Set(g.records.flatMap(r=>[...r.revisions,...r.reviews].map(e=>r.id+":"+e.id)));
 if([...Object.keys(g.provenance),...Object.keys(g.signatures)].some(k=>!eventKeys.has(k)))ctx.addIssue({code:"custom",message:"Unknown provenance event"});
 if(records.size!==g.records.length||Object.entries(g.selected).some(([key,v])=>!records.get(key)?.revisions.some(r=>r.id===v))||Object.values(g.links).some(v=>!records.has(v)))ctx.addIssue({code:'custom',message:'Invalid group record links'});
});
export const sharingSchema=z.object({member:memberSchema.nullable().default(null),groups:z.array(sharingGroupSchema).max(MAX_SHARED_GROUPS).default([])}).default({member:null,groups:[]}).superRefine((s,ctx)=>{
 if(new Set(s.groups.map(g=>g.id)).size!==s.groups.length)ctx.addIssue({code:'custom',message:'Duplicate shared group IDs'});
});
export type SharedPayload=z.infer<typeof sharedPayloadSchema>;
export type SharedRecord=z.infer<typeof sharedRecordSchema>;
export type SharedGroup=z.infer<typeof sharingGroupSchema>;
export type SharedPackage=z.infer<typeof sharedPackageSchema>;
export type SharedReview=z.infer<typeof sharedReviewSchema>;
