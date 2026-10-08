import {overlaps,uncovered,type Bounds} from './area-cache';
import {parcelInBounds} from './geo';
export function parcelTiles(b:Bounds){
 const ny=Math.ceil((b[2]-b[0])/.01),nx=Math.ceil((b[3]-b[1])/.01);
 if(nx*ny>256)throw new Error('This parcel search is too large. Choose an AOI with a smaller bounding box.');
 const tiles:Bounds[]=[];for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)tiles.push([b[0]+(b[2]-b[0])*y/ny,b[1]+(b[3]-b[1])*x/nx,b[0]+(b[2]-b[0])*(y+1)/ny,b[1]+(b[3]-b[1])*(x+1)/nx]);return tiles;
}
const size=(b:Bounds)=>(b[2]-b[0])*(b[3]-b[1]);
// Each section uses the existing spatial cache. There is no 4,000-record AOI cap.
export async function loadParcelArea(bbox:Bounds,request:(bbox:Bounds,cacheOnly:boolean)=>Promise<any>,progress:(data:any)=>void,signal?:AbortSignal){
 const cached=await request(bbox,true);if(signal?.aborted)return;
 progress(cached);if(cached.unsupported||!cached.partial)return cached;
 const tiles=parcelTiles(bbox).filter(t=>(cached.missing||[bbox]).some((b:Bounds)=>overlaps(t,b)));
 const rows=new Map<string,any>((cached.rows||[]).map((r:any)=>[r.id,r]));
 const covered:Bounds[]=uncovered(bbox,cached.missing||[bbox]);let next=0,done=0,failures=0,cacheFailures=0,capped=0,fetchedAt=cached.fetchedAt;
 function state(){const missing=uncovered(bbox,covered),coverage=100*(1-missing.reduce((n,b)=>n+size(b),0)/size(bbox));return {rows:[...rows.values()],missing,coverage:Math.max(0,Math.min(100,coverage)),partial:missing.length>0,cached:false,fetchedAt,stale:[...rows.values()].some(r=>r.stale),warning:[done<tiles.length?`Loading parcel sections: ${done}/${tiles.length}.`:null,failures?`${failures} sections could not refresh; use Load property records to retry.`:null,capped?`${capped} sections returned incomplete records; narrow the area to inspect gaps.`:null,cacheFailures?'Some loaded records could not be saved to the area cache.':null].filter(Boolean).join(' ')};}
 async function worker(){while(next<tiles.length&&!signal?.aborted){const tile=tiles[next++];try{const d=await request(tile,false);if(signal?.aborted)return;if(!d.partial){for(const [id,r] of rows)if(r.geometry&&parcelInBounds(r.geometry,tile))rows.delete(id);}for(const r of d.rows||[])rows.set(r.id,r);covered.push(...uncovered(tile,d.missing||[tile]));if(d.fetchedAt&&(!fetchedAt||d.fetchedAt>fetchedAt))fetchedAt=d.fetchedAt;if(d.cacheWriteFailed)cacheFailures++;if(d.partial)capped++;}catch(e){if(signal?.aborted)return;failures++;}done++;progress(state());}}
 await Promise.all([worker(),worker(),worker()]);if(signal?.aborted)return;const result=state();progress(result);return result;
}
