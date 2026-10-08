import {storage} from "./storage";
import {overlaps,type Bounds,type Snapshot} from "./area-cache";
import {serializeSnapshotRecords,decodeSnapshotRecords} from './snapshot-chunks';
export async function readSnapshots(kind:string,bbox:Bounds):Promise<Snapshot[]>{
 const db=storage();const records=await db.prepare("SELECT content FROM area_snapshots WHERE kind = ? AND south < ? AND north > ? AND west < ? AND east > ? ORDER BY fetched_at DESC LIMIT 1000").bind(kind,bbox[2],bbox[0],bbox[3],bbox[1]).all<{content:string}>();
 const result=decodeSnapshotRecords(records.results.map(r=>JSON.parse(r.content)));
 // Preserve place snapshots collected before the spatial cache was introduced.
 if(kind==="resources"){const old=await db.prepare("SELECT id,content FROM place_cache WHERE id NOT LIKE 'community:%' AND id NOT LIKE 'conditions:%' ORDER BY fetched_at DESC LIMIT 100").all<{id:string;content:string}>();for(const r of old.results){const b=r.id.split(",").map(Number) as Bounds;if(b.length!==4||b.some(n=>!Number.isFinite(n))||!overlaps(b,bbox))continue;const d=JSON.parse(r.content);if(result.some(s=>s.bbox.join(",")===b.join(",")&&s.fetchedAt>=d.fetchedAt))continue;result.push({...d,bbox:b,complete:d.rows.length<(d.limit||1500)});}}
 return result;
}
export async function writeSnapshot(kind:string,snapshot:Snapshot){
 const [s,w,n,e]=snapshot.bbox,db=storage(),chunks=serializeSnapshotRecords(snapshot);
 const statements=[db.prepare('DELETE FROM area_snapshots WHERE kind=? AND south=? AND west=? AND north=? AND east=?').bind(kind,s,w,n,e),...chunks.map((chunk,i)=>db.prepare('INSERT INTO area_snapshots (id,kind,south,west,north,east,content,fetched_at,complete) VALUES (?,?,?,?,?,?,?,?,?)').bind(kind+':'+snapshot.bbox.join(',')+':'+i,kind,s,w,n,e,JSON.stringify(chunk),snapshot.fetchedAt,snapshot.complete?1:0))];
 await db.batch(statements);
}
