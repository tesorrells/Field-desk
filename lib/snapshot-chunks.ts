import type {Snapshot} from './area-cache';
type Chunk=Snapshot&{chunkKey?:string;chunkIndex?:number;chunkCount?:number};
export function splitSnapshot(snapshot:Snapshot,maxBytes=750000):Chunk[]{
 const encoder=new TextEncoder(),groups:any[][]=[[]];let bytes=0;
 for(const row of snapshot.rows){const size=encoder.encode(JSON.stringify(row)).length+1;if(size>maxBytes)throw new Error('One source record exceeds the cache record limit.');if(bytes+size>maxBytes){groups.push([]);bytes=0;}groups[groups.length-1].push(row);bytes+=size;}
 const key=snapshot.bbox.join(',')+':'+snapshot.fetchedAt;
 return groups.map((rows,index)=>({...snapshot,rows,chunkKey:key,chunkIndex:index,chunkCount:groups.length}));
}
export function assembleSnapshots(chunks:Chunk[]):Snapshot[]{
 const result:Snapshot[]=[],groups=new Map<string,Chunk[]>();
 for(const c of chunks){if(!c.chunkKey){result.push(c);continue;}const g=groups.get(c.chunkKey)||[];g.push(c);groups.set(c.chunkKey,g);}
 for(const g of groups.values()){const unique=[...new Map(g.map(c=>[c.chunkIndex,c])).values()].sort((a,b)=>(a.chunkIndex||0)-(b.chunkIndex||0));result.push({...unique[0],rows:unique.flatMap(c=>c.rows),complete:unique[0].complete&&unique.length===unique[0].chunkCount});}
 return result;
}
// Some modeled floodplains are a single very large polygon. Split serialized
// snapshots losslessly so polygon rings and holes need no simplification.
export function serializeSnapshotRecords(snapshot:Snapshot):any[]{
 try{return splitSnapshot(snapshot);}catch(error){const json=JSON.stringify(snapshot),key=snapshot.bbox.join(',')+':'+snapshot.fetchedAt,count=Math.ceil(json.length/100000);return Array.from({length:count},(_,index)=>({encoding:'snapshot-json-fragments-v1',key,index,count,text:json.slice(index*100000,(index+1)*100000)}));}
}
export function decodeSnapshotRecords(records:any[]):Snapshot[]{
 const ordinary:Chunk[]=[],groups=new Map<string,any[]>();
 for(const r of records){if(r.encoding!=='snapshot-json-fragments-v1'){ordinary.push(r);continue;}const g=groups.get(r.key)||[];g.push(r);groups.set(r.key,g);}
 const result=assembleSnapshots(ordinary);for(const g of groups.values()){const parts=[...new Map(g.map(p=>[p.index,p])).values()].sort((a,b)=>a.index-b.index);if(parts.length!==parts[0].count||parts.some((p,i)=>p.index!==i))continue;result.push(JSON.parse(parts.map(p=>p.text).join('')));}
 return result;
}
