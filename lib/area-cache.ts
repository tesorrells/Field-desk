import {parcelInBounds} from './geo';
export type Bounds=[number,number,number,number];
export type Snapshot={bbox:Bounds;rows:any[];fetchedAt:string;complete:boolean;provider?:string;limit?:number};
export const cacheTTL:Record<string,number>={alpr:86400000,repeaters:86400000,poweroutages:120000,wildfires:900000,closurestatus:120000,watergauges:300000,risktracts:86400000,firestations:86400000,emsstations:86400000,esd:86400000,water:86400000,sewer:86400000,resources:86400000,"311":900000,traffic:120000,fire:120000,parcels:86400000,crime:3600000,fema:86400000,modeled:86400000,crossings:86400000};
export function overlaps(a:Bounds,b:Bounds){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
export function hasPoint(b:Bounds,lat:number,lng:number){return lat>=b[0]&&lat<=b[2]&&lng>=b[1]&&lng<=b[3];}
const size=(b:Bounds)=>(b[2]-b[0])*(b[3]-b[1]);
export function uncovered(bbox:Bounds,covered:Bounds[]){let remaining:Bounds[]=[bbox];for(const b of covered){remaining=remaining.flatMap(a=>{if(!overlaps(a,b))return[a];const s=Math.max(a[0],b[0]),w=Math.max(a[1],b[1]),n=Math.min(a[2],b[2]),e=Math.min(a[3],b[3]);const parts:Bounds[]=[[a[0],a[1],s,a[3]],[n,a[1],a[2],a[3]],[s,a[1],n,w],[s,e,n,a[3]]];return parts.filter(p=>size(p)>1e-12);});}return remaining;}
export function cacheView(kind:string,bbox:Bounds,snapshots:Snapshot[],now=Date.now()){
 const sorted=snapshots.filter(s=>overlaps(s.bbox,bbox)).sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt));
 const fresh=sorted.filter(s=>now-Date.parse(s.fetchedAt)<cacheTTL[kind]);
 const missing=uncovered(bbox,fresh.filter(s=>s.complete).map(s=>s.bbox));
 const seen=new Set<string>(),rows:any[]=[];
 const within=(row:any,b:Bounds)=>row.geometry?parcelInBounds(row.geometry,b):hasPoint(b,row.lat,row.lng);
 for(let i=0;i<sorted.length;i++){const snap=sorted[i];for(const row of snap.rows){if(!Number.isFinite(row.lat)||!Number.isFinite(row.lng)||!within(row,bbox)||seen.has(row.id))continue;seen.add(row.id);if(sorted.slice(0,i).some(newer=>newer.complete&&within(row,newer.bbox)))continue;rows.push({...row,retrievedAt:snap.fetchedAt,stale:now-Date.parse(snap.fetchedAt)>=cacheTTL[kind]});}}
 return {rows,missing,coverage:Math.max(0,Math.min(100,100*(1-missing.reduce((a,b)=>a+size(b),0)/size(bbox)))),fetchedAt:sorted[0]?.fetchedAt||null,cached:true,stale:rows.some(x=>x.stale),partial:missing.length>0};
}
export function missingExtent(parts:Bounds[]):Bounds|null{return parts.length?[Math.min(...parts.map(x=>x[0])),Math.min(...parts.map(x=>x[1])),Math.max(...parts.map(x=>x[2])),Math.max(...parts.map(x=>x[3]))]:null;}
