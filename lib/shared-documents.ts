import {z} from 'zod';
import {evidenceSchema,questionSchema,requirementSchema} from './collection';
import {servicePlanSchema,resourceSnapshotSchema,dependencySchema,alternativeSchema} from './dependencies';
import {scenarioCoreSchema,indicatorSchema} from './scenarios';

const evidence=evidenceSchema.omit({id:true,recordId:true}).strict();
const requirement=requirementSchema.omit({id:true,naiIds:true,evidenceIds:true}).strict();
const question=questionSchema.innerType().omit({id:true,naiIds:true,evidence:true,requirements:true}).extend({requirements:z.array(requirement).max(50)}).strict();
const resource=resourceSnapshotSchema.omit({id:true}).strict();
const dependency=dependencySchema.innerType().omit({id:true}).strict();
const alternative=alternativeSchema.innerType().omit({id:true,resource:true}).extend({resource:resource.nullable()}).strict();
const service=servicePlanSchema.omit({id:true,questionIds:true,primary:true,dependencies:true,alternatives:true}).extend({primary:resource.nullable(),dependencies:z.array(dependency).max(20),alternatives:z.array(alternative).max(20)}).strict().superRefine((p,c)=>{for(const item of [...p.dependencies,...p.alternatives])if(item.status!=='Unverified'&&(!item.source.trim()||!item.verifiedOn))c.addIssue({code:'custom',message:'Verified service items need a source and date.'});});
const indicator=indicatorSchema.innerType().omit({id:true,evidenceIds:true}).strict().superRefine((i,c)=>{if(i.basis==='Official instruction'&&(!i.source.trim()||!i.sourceUrl||!i.sourceDate))c.addIssue({code:'custom',message:'Official instructions need a source, URL and date.'});});
const scenario=scenarioCoreSchema.omit({id:true,questionIds:true,naiIds:true,servicePlanIds:true,routeIds:true,evidence:true,indicators:true,actions:true,exercises:true}).extend({indicators:z.array(indicator).max(20),actions:z.array(scenarioCoreSchema.shape.actions.innerType().element.omit({id:true}).strict()).max(20),exercises:z.array(scenarioCoreSchema.shape.exercises.innerType().element.omit({id:true}).strict()).max(20)}).strict().superRefine((s,c)=>{if(s.status==='Reviewed'&&(!s.assessedOn||!s.reviewOn||!s.assessmentReason.trim()||s.confidence==='Unassessed'||!s.confidenceReason.trim()))c.addIssue({code:'custom',message:'Reviewed scenarios need assessment dates and rationale.'});});
export const documentKinds=['finding','evidence','question','service-plan','scenario'] as const;
const base={name:z.string().trim().min(1).max(500),detail:z.string().max(50000),references:z.array(z.object({recordId:z.string().uuid(),kind:z.enum([...documentKinds,'route','boundary'])}).strict()).max(400),omittedLinks:z.number().int().min(0).max(1000)};
export const sharedDocumentShapes=[
 z.object({...base,kind:z.literal('finding'),content:z.object({section:z.string().min(1).max(200)}).strict()}).strict(),
 z.object({...base,kind:z.literal('evidence'),content:evidence}).strict(),
 z.object({...base,kind:z.literal('question'),content:question}).strict(),
 z.object({...base,kind:z.literal('service-plan'),content:service}).strict(),
 z.object({...base,kind:z.literal('scenario'),content:scenario,omittedHistory:z.number().int().min(0).max(20)}).strict(),
] as const;
