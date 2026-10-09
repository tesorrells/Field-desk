import {PLACE_PROVIDERS} from './places';
import {validArea,validPoint} from './location-core';
import type {Bounds} from './area-cache';
export const alprSource='OpenStreetMap ALPR';
export const alprLimit=2000;
export function alprQuery(bbox:Bounds){
 if(!validArea(bbox))throw Error('Choose a smaller area with valid coordinates.');
 return `[out:json][timeout:18];nwr["surveillance:type"="ALPR"](${bbox.join(',')});out meta center ${alprLimit};`;
}
const text=(value:unknown)=>typeof value==='string'?value.trim().slice(0,600):'';
export function parseAlpr(data:any,bbox:Bounds){
 if(!data||!Array.isArray(data.elements))throw Error('Invalid ALPR response from Overpass.');
 if(data.remark)throw Error('Overpass returned an incomplete ALPR query.');
 const rows:any[]=[];const seen=new Set<string>();let invalid=0;
 for(const x of data.elements){
  if(!x||!['node','way','relation'].includes(x.type)||!Number.isSafeInteger(x.id)||x.id<=0){invalid++;continue;}
  const t=x.tags||{};if(t['surveillance:type']!=='ALPR')continue;
  const lat=x.lat??x.center?.lat,lng=x.lon??x.center?.lon;
  if(typeof lat!=='number'||typeof lng!=='number'||!validPoint(lat,lng)){invalid++;continue;}
  if(lat<bbox[0]||lat>bbox[2]||lng<bbox[1]||lng>bbox[3])continue;
  const id=`osm-alpr-${x.type}-${x.id}`;if(seen.has(id))continue;seen.add(id);
  const manufacturer=text(t.manufacturer)||text(t.brand),operator=text(t.operator),direction=text(t.direction)||text(t['camera:direction']);
  const updatedDate=typeof x.timestamp==='string'&&Number.isFinite(Date.parse(x.timestamp))?x.timestamp:undefined;
  rows.push({id,name:text(t.name)||[manufacturer,'ALPR camera'].filter(Boolean).join(' '),lat,lng,category:'ALPR cameras',source:alprSource,url:`https://www.openstreetmap.org/${x.type}/${x.id}`,updatedDate,confidence:'Reported by source',detail:[manufacturer&&`Manufacturer / brand: ${manufacturer}`,text(t.model)&&`Model: ${text(t.model)}`,operator&&`Operator: ${operator}`,direction&&`Reported direction: ${direction}`,text(t['camera:mount'])&&`Mount: ${text(t['camera:mount'])}`,text(t['surveillance:zone'])&&`Zone: ${text(t['surveillance:zone'])}`,text(t.check_date)&&`Mapper check_date (unverified): ${text(t.check_date)}`,x.type!=='node'&&'Approximate centre of mapped feature.', 'Community-reported ALPR location from OpenStreetMap, the underlying source used by DeFlock. Camera presence and operation are not verified. The update date is an OSM edit, not an installation or inspection date.', '© OpenStreetMap contributors · ODbL · https://www.openstreetmap.org/copyright'].filter(Boolean).join(' · ')});
 }
 return {rows,complete:data.elements.length<alprLimit&&invalid===0,limit:alprLimit,invalid,warning:[data.elements.length>=alprLimit?'The ALPR query reached its 2,000-feature cap. Narrow the area.':'',invalid?'Malformed ALPR records were excluded; coverage is incomplete.':''].filter(Boolean).join(' ')||undefined};
}
export async function fetchAlpr(bbox:Bounds,fetcher:typeof fetch=fetch){
 const query=alprQuery(bbox),failures:string[]=[];
 for(const provider of PLACE_PROVIDERS){
  try{
   const response=await fetcher(provider.url+'?'+new URLSearchParams({data:query}),{headers:{Accept:'application/json','User-Agent':'FieldDesk/1.0'},signal:AbortSignal.timeout(22000)});
   if(!response.ok)throw Error(`HTTP ${response.status}`);
   const parsed=parseAlpr(await response.json(),bbox);
   return {...parsed,fetchedAt:new Date().toISOString(),provider:provider.name};
  }catch(error){failures.push(`${provider.name}: ${error instanceof Error?error.message:'connection failed'}`);}
 }
 throw Error(`ALPR source unavailable. ${failures.join('; ')}. This does not mean there are no cameras in this area.`);
}
