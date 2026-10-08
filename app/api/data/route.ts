import {packsForArea} from '../../../lib/local-source-packs';
import {combineSources} from '../../../lib/arcgis-area';
import {fetchHaysClosures} from '../../../lib/hays-data';
import {validArea} from '../../../lib/location-core';
import {regionalCoverage} from '../../../lib/source-regions';
import {fetchBluebonnet} from '../../../lib/lifelines';
import {fetchWildfires} from '../../../lib/wildfire';
import {fetchCrossingStatuses,crossingBounds} from '../../../lib/crossing-status';
import {cachedCondition} from '../../../lib/conditions-storage';
import {fetchWaterGauges} from '../../../lib/water-gauges';
import {fetchRiskArea} from '../../../lib/hazards';
import {fetchServices,serviceLayers} from "../../../lib/services";
import {fetchFlood,fetchNationalFlood} from "../../../lib/flood";
import {fetchCrime} from "../../../lib/crime";
import {fetchPlaces} from "../../../lib/places";
import {fetchParcels} from "../../../lib/parcels";
import {readSnapshots,writeSnapshot} from "../../../lib/snapshot-storage";
import {cacheView,missingExtent,type Bounds,type Snapshot} from "../../../lib/area-cache";
async function json(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Austin data returned HTTP ${r.status}`);return r.json() as Promise<any>;}
const response=(d:any)=>Response.json(d,{headers:{"Cache-Control":"no-store"}});
async function collect(kind:string,bbox:Bounds){
 if(kind==="poweroutages"){const c=await cachedCondition("bluebonnet-outages-v1",120000,()=>fetchBluebonnet());if(c.error||!c.data)throw Error(c.error||"Bluebonnet unavailable");return {rows:c.data.rows.filter((p:{lat:number;lng:number})=>p.lat>=bbox[0]&&p.lat<=bbox[2]&&p.lng>=bbox[1]&&p.lng<=bbox[3]),complete:true,limit:5000,fetchedAt:c.fetchedAt!,provider:"Bluebonnet public outage map",warning:c.cacheWarning};}
 if(kind==="fema")return fetchNationalFlood(bbox);
 if(kind==="wildfires")return fetchWildfires(bbox);
 if(kind==="closurestatus"){const tasks=[{name:'ATXFloods',run:async()=>{const c=await cachedCondition("atxfloods-crossings-v2",120000,()=>fetchCrossingStatuses());if(c.error||!c.data)throw Error(c.error||"ATXFloods unavailable");return {...c.data,rows:crossingBounds(c.data.rows,bbox),fetchedAt:c.fetchedAt||c.data.fetchedAt,warning:c.cacheWarning};}}];if(packsForArea(bbox).some(p=>p.id==='hays'))tasks.push({name:'Hays closure points',run:()=>fetchHaysClosures(bbox)});const data=await combineSources(tasks);return {...data,warning:[data.warning,'Hays sources show closure/block points only; line closures, detours and road hazards require the official county map. Empty results do not establish safe travel.'].filter(Boolean).join(' ')};}
 if(kind==="watergauges")return fetchWaterGauges(bbox);
 if(kind==="risktracts")return fetchRiskArea(bbox);
 if(serviceLayers[kind])return fetchServices(kind,bbox);
 if(kind==="resources")return fetchPlaces(bbox);
 if(kind==="parcels")return fetchParcels(bbox);
 if(kind==="crime")return fetchCrime(bbox);
 if(["fema","modeled","crossings"].includes(kind))return fetchFlood(kind,bbox);
 const [s,w,n,e]=bbox;
 const is311=kind==="311",id=is311?"xwdj-i9he":kind==="traffic"?"dx9v-zd7x":"wpu4-x69d";
 const field=is311?"sr_created_date":"published_date",lat=is311?"sr_location_lat":"latitude",lng=is311?"sr_location_long":"longitude";
 const since=new Date(Date.now()-(is311?90:1)*86400000).toISOString().slice(0,is311?19:24);
 const url=new URL(`https://data.austintexas.gov/resource/${id}.json`);url.search=new URLSearchParams({"$where":`${field} >= '${since}' AND ${lat} BETWEEN ${s} AND ${n} AND ${lng} BETWEEN ${w} AND ${e}`,"$order":`${field} DESC`,"$limit":"1000"}).toString();
 const data=await json(url.toString());
 return {rows:data.map((x:any)=>is311?{id:x.sr_number,name:x.sr_type_desc,lat:Number(x.sr_location_lat),lng:Number(x.sr_location_long),category:"311 reports",source:"Austin 311",date:x.sr_created_date,updatedDate:x.sr_updated_date,closedDate:x.sr_closed_date,status:x.sr_status_desc,url:"https://data.austintexas.gov/d/xwdj-i9he"}:{id:kind+":"+x.traffic_report_id,name:x.issue_reported,lat:Number(x.latitude),lng:Number(x.longitude),category:kind==="traffic"?"Traffic incidents":"Fire incidents",source:kind==="traffic"?"Austin traffic":"Austin fire",date:x.published_date,updatedDate:x.traffic_report_status_date_time,status:x.traffic_report_status,detail:[x.address,x.agency?.trim()].filter(Boolean).join(" · "),url:`https://data.austintexas.gov/d/${id}`}),limit:1000,fetchedAt:new Date().toISOString(),provider:"City of Austin"};
}
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get("kind")||"";
 const bbox=(p.get("bbox")||"").split(",").map(Number) as Bounds;const [s,w,n,e]=bbox;
 if(!validArea(bbox))return Response.json({error:'Choose a smaller area with valid coordinates.'},{status:400});
 const region=regionalCoverage(kind,bbox);if(region&&!region.available)return response({rows:[],coverage:0,partial:true,stale:false,unsupported:true,warning:region.warning});
 try{
  if(!serviceLayers[kind]&&!["poweroutages","wildfires","closurestatus","watergauges","risktracts","resources","311","traffic","fire","parcels","crime","fema","modeled","crossings"].includes(kind))return Response.json({error:"Unknown source"},{status:400});
  const cacheKind=kind==='fema'?'fema-nfhl-v1':['parcels','water','sewer','closurestatus'].includes(kind)?kind+'-local-v2':kind;let snapshots:Snapshot[]=[];let cacheError=false;
  try{snapshots=await readSnapshots(cacheKind,bbox);}catch(error){cacheError=true;console.warn("Area cache unavailable",error);}
  const cached={...cacheView(kind,bbox,snapshots),warning:region?.warning||undefined};
  if(p.get("cacheOnly")==="1")return response({...cached,cacheUnavailable:cacheError});
  if(!cached.partial)return response({...cached,provider:"Stored area snapshots"});
  const extent=missingExtent(cached.missing)||bbox;
  try{
   const data=await collect(kind,extent);const snapshot:Snapshot={...data,bbox:extent,complete:'complete' in data?data.complete as boolean:data.rows.length<data.limit};
   let cacheWriteFailed=false;try{await writeSnapshot(cacheKind,snapshot);}catch(error){cacheWriteFailed=true;console.warn("Could not store area snapshot",error);}
   const merged=cacheView(kind,bbox,[snapshot,...snapshots]);
   return response({...merged,provider:data.provider,cached:false,reusedCount:cached.rows.length,limit:data.limit,cacheWriteFailed,warning:[region?.warning,("warning" in data&&data.warning),cacheWriteFailed?"Records loaded, but could not be cached for future areas.":"",merged.partial?"Source coverage is incomplete or capped; some records may be missing.":""].filter(Boolean).join(" ")||undefined});
  }catch(error){const detail=error instanceof Error?error.message:"Source unavailable";if(cached.rows.length)return response({...cached,warning:`Refresh failed. Showing ${cached.rows.length} cached records; coverage may be incomplete. ${detail}`});return Response.json({error:detail,rows:[],coverage:cached.coverage},{status:502});}
 }catch(error){console.warn("Public data request failed",kind,error);return Response.json({error:"Source data could not be loaded. Try again shortly."},{status:502});}
}
