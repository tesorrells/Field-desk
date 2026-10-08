import {parcelIntersects,type Point} from './geo';
import {distanceToRoute,routeMiles,type TerrainRecord} from './routes';
import type {Bounds} from './area-cache';
export const corridorSources=[{kind:'resources',name:'Places & supplies'},{kind:'fema',name:'FEMA flood zones'},{kind:'crossings',name:'Texas crossing inventory'},{kind:'closurestatus',name:'Reported crossing statuses'},{kind:'wildfires',name:'Wildfire incident points'}];
export type CorridorSource={kind:string;name:string;complete:number;total:number;stale:number;unsupported:number;failed:number;skipped?:number;count:number;warnings:string[]};
export type CorridorReport={signature:string;width:250|500|1000;collectedAt:string;sources:CorridorSource[];count:number};
export type CorridorRecord=TerrainRecord & {category:string;url?:string;date?:string;detail?:string};
export const routeSignature=(points:Point[])=>JSON.stringify(points);
// Small overlapping segment envelopes conservatively include the buffered line.
export function corridorSections(points:Point[],width:number):Bounds[]{
 if(points.length<2||points.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>70||Math.abs(p[1])>180)||![250,500,1000].includes(width)||routeMiles(points)>200)throw Error('Corridor collection supports routes up to 200 miles between 70° south and north.');
 const boxes:Bounds[]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(routeMiles([a,b])*1609.344/2000));for(let j=0;j<steps;j++){const p:Point=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps],q:Point=[a[0]+(b[0]-a[0])*(j+1)/steps,a[1]+(b[1]-a[1])*(j+1)/steps],dy=width/111320,dx=dy/Math.cos(Math.max(Math.abs(p[0]),Math.abs(q[0]))*Math.PI/180);boxes.push([Math.max(-70,Math.min(p[0],q[0])-dy),Math.max(-180,Math.min(p[1],q[1])-dx),Math.min(70,Math.max(p[0],q[0])+dy),Math.min(180,Math.max(p[1],q[1])+dx)]);}}return boxes;
}
export function corridorTiles(points:Point[],width:number){const tiles=new Map<string,Bounds>(),size=.08;for(const b of corridorSections(points,width))for(let y=Math.floor(b[0]/size);y<=Math.floor(b[2]/size);y++)for(let x=Math.floor(b[1]/size);x<=Math.floor(b[3]/size);x++){const tile:Bounds=[Math.max(-70,y*size),Math.max(-180,x*size),Math.min(70,(y+1)*size),Math.min(180,(x+1)*size)];tiles.set(`${y}:${x}`,tile);}if(tiles.size>80)throw Error('This route needs more than 80 search tiles. Split it into shorter saved routes.');return [...tiles.values()];}
export function inCorridor(row:TerrainRecord,points:Point[],width:number,sections=corridorSections(points,width)){return row.geometry?sections.some(b=>parcelIntersects(row.geometry!,[[b[0],b[1]],[b[0],b[3]],[b[2],b[3]],[b[2],b[1]]])):distanceToRoute([row.lat,row.lng],points)<=width;}

type SourceResponse={error?:string;unsupported?:boolean;partial?:boolean;stale?:boolean;warning?:string;rows?:CorridorRecord[]};
export async function collectRouteCorridor(points:Point[],width:250|500|1000,signal:AbortSignal,progress:(done:number,total:number)=>void,fetcher:typeof fetch=fetch){
 const tiles=corridorTiles(points,width),sections=corridorSections(points,width);
 const rows=new Map<string,CorridorRecord>();
 const sources:CorridorSource[]=corridorSources.map(s=>({...s,complete:0,total:tiles.length,stale:0,unsupported:0,failed:0,skipped:0,count:0,warnings:[]}));
 const sourceIds=new Map(sources.map(s=>[s.kind,new Set<string>()]));
 // Interleave sources to keep a slow provider from blocking all other checks.
 const jobs=tiles.flatMap(bbox=>sources.map(source=>({source,bbox})));
 let next=0,done=0;
 const warn=(source:CorridorSource,message:string)=>{if(!source.warnings.includes(message))source.warnings.push(message.slice(0,1000));};
 async function worker(){
  while(next<jobs.length&&!signal.aborted){
   const {source,bbox}=jobs[next++];
   if(source.failed>=3){source.skipped=(source.skipped||0)+1;warn(source,'Further sections were skipped after repeated source failures. Refresh to retry this source.');}
   else try{
    const r=await fetcher('/api/data?'+new URLSearchParams({kind:source.kind,bbox:bbox.join(',')}),{signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
    const d=await r.json() as SourceResponse;
    if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);
    if(d.unsupported)source.unsupported++;
    else if(!d.partial&&!d.stale)source.complete++;
    if(d.stale)source.stale++;
    if(d.warning)warn(source,d.warning);
    const found=(d.rows||[]).filter(row=>Number.isFinite(row.lat)&&Number.isFinite(row.lng)&&inCorridor(row,points,width,sections));
    for(const row of found){
     const old=rows.get(row.id);
     if(!old||Date.parse(row.retrievedAt||'')>Date.parse(old.retrievedAt||''))rows.set(row.id,row);
     sourceIds.get(source.kind)!.add(row.id);
    }
    source.count=sourceIds.get(source.kind)!.size;
   }catch(e){if(signal.aborted)return;source.failed++;warn(source,(e as Error).message);}
   done++;if(!signal.aborted)progress(done,jobs.length);
  }
 }
 await Promise.all([worker(),worker()]);
 if(signal.aborted)throw new DOMException('Collection cancelled','AbortError');
 const report:CorridorReport={signature:routeSignature(points),width,collectedAt:new Date().toISOString(),sources:sources.map(s=>({...s,warnings:s.warnings.slice(0,5)})),count:rows.size};
 return {report,rows:[...rows.values()]};
}
