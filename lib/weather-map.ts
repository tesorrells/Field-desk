import {validPoint} from './location-core';
import {parcelInBounds,type ParcelGeometry} from './geo';
import type {Bounds} from './area-cache';
export type RadarFrame={time:number;path:string};
export type RadarManifest={generated:number;host:string;frames:RadarFrame[]};
export type MapAlert={id:string;event:string;headline:string;severity:string;sent?:string;onset?:string;expires:string;ends?:string;description:string;instruction:string;url:string;geometry:ParcelGeometry};
export type AlertFeed={rows:MapAlert[];unmapped:number;invalid:number};
export function parseRadar(data:any):RadarManifest{
 if(data?.host!=='https://tilecache.rainviewer.com'||!Number.isSafeInteger(data.generated)||!Array.isArray(data.radar?.past)||!data.radar.past.length||data.radar.past.length>30)throw Error('Radar timeline unavailable or changed format.');
 const frames:RadarFrame[]=data.radar.past.map((f:any)=>{if(!Number.isSafeInteger(f.time)||f.time<=0||typeof f.path!=='string'||!/^\/v2\/radar\/[a-zA-Z0-9_-]+$/.test(f.path))throw Error('Invalid radar frame.');return {time:f.time,path:f.path};});
 return {host:data.host,generated:data.generated,frames:[...new Map(frames.sort((a,b)=>a.time-b.time).map(f=>[f.time,f])).values()]};
}
export function radarTileUrl(manifest:RadarManifest,frame:RadarFrame){return `${manifest.host}${frame.path}/256/{z}/{x}/{y}/2/0_0.png`;}
export function validWeatherBounds(b:number[]):b is Bounds{return b.length===4&&validPoint(b[0],b[1])&&validPoint(b[2],b[3])&&b[0]<b[2]&&b[1]<b[3];}
export function weatherPolygon(value:any):ParcelGeometry|null{
 if(!value||!['Polygon','MultiPolygon'].includes(value.type)||!Array.isArray(value.coordinates))return null;
 const polys=value.type==='Polygon'?[value.coordinates]:value.coordinates;let count=0;
 if(!polys.length||polys.length>100)return null;
 for(const poly of polys){if(!Array.isArray(poly)||!poly.length)return null;for(const ring of poly){if(!Array.isArray(ring)||ring.length<4)return null;for(const p of ring){if(!Array.isArray(p)||p.length<2||typeof p[0]!=='number'||typeof p[1]!=='number'||!validPoint(p[1],p[0])||++count>10000)return null;}if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return null;}}
 return {type:value.type,coordinates:value.coordinates};
}
const string=(value:any,max=12000)=>typeof value==='string'?value.slice(0,max):'';
export function parseMapAlerts(features:any[]):AlertFeed{
 const rows:MapAlert[]=[];const seen=new Set<string>();let unmapped=0,invalid=0;
 for(const f of features){const p=f?.properties;
  if(!p||typeof p.event!=='string'||typeof p.id!=='string'||!Number.isFinite(Date.parse(p.expires))){invalid++;continue;}
  if(p.status!=='Actual'||p.messageType==='Cancel')continue;
  if(!f.geometry){unmapped++;continue;}
  const g=weatherPolygon(f.geometry);if(!g){invalid++;continue;}if(seen.has(p.id))continue;seen.add(p.id);
  rows.push({id:p.id,event:string(p.event,200),headline:string(p.headline,1000)||p.event,severity:string(p.severity,40),sent:p.sent,onset:p.onset,expires:p.expires,ends:p.ends,description:string(p.description),instruction:string(p.instruction),url:typeof f.id==='string'&&/^https:\/\/api\.weather\.gov\/alerts\/[^?#]+$/.test(f.id)?f.id:'https://www.weather.gov/',geometry:g});
 }
 return {rows,unmapped,invalid};
}
export function activeMapAlerts(rows:MapAlert[],now=Date.now()) {return rows.filter(a=>Math.min(...[a.expires,a.ends].filter(d=>d&&Number.isFinite(Date.parse(d))).map(d=>Date.parse(d!)))>now);}
export function scopeMapAlerts(feed:AlertFeed,bbox:Bounds,now=Date.now()){return {...feed,rows:activeMapAlerts(feed.rows,now).filter(a=>parcelInBounds(a.geometry,bbox))};}
export function alertColor(alert:MapAlert){return alert.event.includes('Warning')?'#d34242':alert.event.includes('Watch')?'#d99c24':'#6e67b4';}
export async function weatherJson(url:string,fetcher:typeof fetch=fetch){const r=await fetcher(url,{redirect:'error',headers:{Accept:'application/geo+json,application/json','User-Agent':'FieldDesk/1.0 (local weather map)'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Weather source returned HTTP ${r.status}`);const text=await r.text();if(text.length>6000000)throw Error('Weather response exceeds size limit.');return JSON.parse(text);}
export async function fetchRadar(fetcher:typeof fetch=fetch){return parseRadar(await weatherJson('https://api.rainviewer.com/public/weather-maps.json',fetcher));}
export async function fetchMapAlerts(fetcher:typeof fetch=fetch){
 let url='https://api.weather.gov/alerts/active?region_type=land';const features:any[]=[];const seen=new Set<string>();
 for(let page=0;page<6;page++){
  if(seen.has(url))throw Error('NWS alert pagination repeated.');seen.add(url);
  const data=await weatherJson(url,fetcher);if(!Array.isArray(data.features)||features.length+data.features.length>3000)throw Error('Invalid or oversized NWS alert page.');features.push(...data.features);
  const next=data.pagination?.next;if(!next)return parseMapAlerts(features);
  const n=new URL(next,url);if(n.origin!=='https://api.weather.gov'||n.pathname!=='/alerts/active'||n.username||n.password)throw Error('Unexpected NWS pagination link.');url=n.href;
 }
 throw Error('NWS alert feed exceeded the six-page limit; coverage incomplete.');
}
