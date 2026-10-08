import {z} from 'zod';
import {studySchema} from './study-schema';
import {briefingSchema,type Briefing} from './briefing';
import {restorePortfolio,type Portfolio} from './locations';
export const MAX_BACKUP_BYTES=64000000;
export const bytes=(v:string)=>new TextEncoder().encode(v).length;
export const backupSchema=z.object({format:z.literal('area-study-backup'),formatVersion:z.literal(1),createdAt:z.string().datetime(),includesUnsaved:z.boolean(),study:studySchema,briefings:z.array(briefingSchema).max(30).refine(v=>new Set(v.map(b=>b.id)).size===v.length,'Duplicate briefing IDs')}).strict();
export type Backup=z.infer<typeof backupSchema>;
export function makeBackup(study:Portfolio,briefings:Briefing[],includesUnsaved=false):Backup{return backupSchema.parse({format:'area-study-backup',formatVersion:1,createdAt:new Date().toISOString(),includesUnsaved,study,briefings});}
function supportedStudy(raw:unknown){if(!raw||typeof raw!=='object'||!('schemaVersion' in raw)||typeof raw.schemaVersion!=='number'||raw.schemaVersion<2||raw.schemaVersion>12)throw Error('Unsupported study version. Use a complete study export from a supported version (2–11).');return restorePortfolio(raw);}
export function parseBackup(text:string):{backup:Backup;kind:string;sourceVersion:number}{
 if(bytes(text)>MAX_BACKUP_BYTES)throw Error('Backup exceeds the 64 MB import limit.');let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('This file is not valid JSON. No data has changed.');}
 if(!raw||typeof raw!=='object')throw Error('Choose a complete backup or study export.');
 const v=raw as Record<string,unknown>;let study:unknown,kind='Study JSON';const briefings:Briefing[]=[];
 if(v.format==='area-study-backup'){if(v.formatVersion!==1)throw Error('This backup format is not supported. Update the app before importing it.');study=v.study;supportedStudy(study);const b=backupSchema.parse(v);return {backup:b,kind:'Complete backup',sourceVersion:(study as Portfolio).schemaVersion};}
 if(v.type==='FeatureCollection'){if(!v.portfolio)throw Error('This GeoJSON contains map features only. Restore requires a portfolio or complete backup so findings and history are preserved.');study=v.portfolio;kind='Study GeoJSON';}else study=v;
 const portfolio=supportedStudy(study);return {backup:makeBackup(portfolio,briefings),kind,sourceVersion:(study as Portfolio).schemaVersion};
}
export function validateBackupSizes(b:Backup){if(bytes(JSON.stringify(b.study))>1500000)throw Error('The study exceeds the 1.5 MB saved-study limit.');if(b.briefings.some(r=>bytes(JSON.stringify(r))>2000000))throw Error('A briefing exceeds the 2 MB archive limit.');}
export function archiveMerge(existing:Briefing[],incoming:Briefing[]){const ids=new Map(existing.map(b=>[b.id,b]));for(const b of incoming){const prior=ids.get(b.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(b))throw Error('An incoming briefing has the same ID as a different archived version. Existing reports cannot be overwritten.');ids.set(b.id,b);}if(ids.size>30)throw Error('Combined archive exceeds 30 reports. Existing archives are kept; import a study-only export or fewer reports.');return incoming.filter(b=>!existing.some(e=>e.id===b.id));}
export function studyCounts(p:Portfolio){const c=[p,...p.locations];return {frequencies:c.reduce((n,l)=>n+l.radioPlan.length,0),locations:c.length,routes:p.routes.length,notes:c.reduce((n,l)=>n+l.notes.length,0),questions:c.reduce((n,l)=>n+l.collection.questions.length,0),requirements:c.reduce((n,l)=>n+l.collection.questions.reduce((a,q)=>a+q.requirements.length,0),0),scenarios:c.reduce((n,l)=>n+l.scenarios.length,0),services:c.reduce((n,l)=>n+l.servicePlans.length,0),areas:c.reduce((n,l)=>n+l.nais.length,0),reviews:p.reviews.history.length};}
