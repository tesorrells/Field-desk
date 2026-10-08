import {z} from 'zod';
import {storage} from '../../../lib/storage';
import {makeBackup,parseBackup,archiveMerge,validateBackupSizes,bytes,MAX_BACKUP_BYTES} from '../../../lib/backup';
import {briefingSchema} from '../../../lib/briefing';
import {restorePortfolio,emptyContext,mergeConfiguredLocations} from '../../../lib/locations';
import {configuredLocations} from '../../../lib/private-location-config';
const headers={'Cache-Control':'no-store'};
async function state(){const db=storage();const results=await db.batch([db.prepare("SELECT content,updated_at FROM studies WHERE id='primary'"),db.prepare('SELECT snapshot FROM briefings ORDER BY created_at,id')]);const row=results[0].results[0] as {content:string;updated_at:string}|undefined;const raw=row?JSON.parse(row.content):{...emptyContext(),schemaVersion:11,routes:[]};const study=row&&raw.schemaVersion>=11?restorePortfolio(raw):mergeConfiguredLocations(restorePortfolio(raw),configuredLocations());const briefings=(results[1].results as {snapshot:string}[]).map(r=>briefingSchema.parse(JSON.parse(String(r.snapshot))));return {study,briefings,updatedAt:row?.updated_at||null};}
export async function GET(){try{const s=await state();return Response.json({backup:makeBackup(s.study,s.briefings),updatedAt:s.updatedAt},{headers});}catch{return Response.json({error:'Complete backup is unavailable. Retry when study and archive storage return; the GeoJSON screen export is still available.'},{status:503,headers});}}
const requestSchema=z.object({backup:z.unknown(),expectedUpdatedAt:z.string().datetime().nullable()}).strict();
export async function POST(request:Request){
 let input:z.infer<typeof requestSchema>,backup:ReturnType<typeof parseBackup>['backup'];
 try{const text=await request.text();if(bytes(text)>MAX_BACKUP_BYTES+1000)return Response.json({error:'Restore request exceeds 64 MB.'},{status:413,headers});input=requestSchema.parse(JSON.parse(text));backup=parseBackup(JSON.stringify(input.backup)).backup;validateBackupSizes(backup);}catch(e){return Response.json({error:e instanceof z.ZodError?'Backup validation failed. Check the file version, IDs, dates, coordinates and linked items.':e instanceof Error?e.message:'Invalid backup.'},{status:400,headers});}
 try{const s=await state();if(s.updatedAt!==input.expectedUpdatedAt)return Response.json({error:'The saved study changed after the preview. Download a new recovery backup and preview the import again.'},{status:409,headers});let additions;try{additions=archiveMerge(s.briefings,backup.briefings);}catch(e){return Response.json({error:e instanceof Error?e.message:'Archive conflict.'},{status:409,headers});}
 const db=storage(),expected=input.expectedUpdatedAt||'',guard="COALESCE((SELECT updated_at FROM studies WHERE id='primary'),'')=?",updatedAt=new Date().toISOString();
 // One transaction. Every insert is guarded by the pre-restore revision; the
 // study write is last. Unique/NOT NULL conflicts roll back the entire batch.
 const commands=additions.map(b=>db.prepare(`INSERT INTO briefings (id,title,created_at,scope,snapshot) SELECT ?,CASE WHEN (SELECT COUNT(*) FROM briefings)>=30 THEN NULL ELSE ? END,?,?,? WHERE ${guard}`).bind(b.id,b.title,b.generatedAt,b.scope,JSON.stringify(b),expected));
 commands.push(db.prepare(`INSERT INTO studies (id,content,updated_at) SELECT ?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at WHERE studies.updated_at=?`).bind('primary',JSON.stringify(backup.study),updatedAt,expected,expected));
 const result=await db.batch(commands);if(!result[result.length-1].meta.changes)return Response.json({error:'A newer study save prevented restore. Preview again; no import was applied.'},{status:409,headers});return Response.json({study:backup.study,updatedAt,addedBriefings:additions.length},{headers});
 }catch{return Response.json({error:'Restore could not be committed. Existing data was kept. Archive capacity or a concurrent archive change may require a new preview.'},{status:409,headers});}
}
