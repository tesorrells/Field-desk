type Phase='requesting'|'reading'|'complete'|'warning'|'error'|'cancelled';
export type CollectionActivity={id:number;name:string;phase:Phase;startedAt:number;finishedAt?:number;detail:string};
let next=0;
let snapshot:CollectionActivity[]=[];
const listeners=new Set<()=>void>();
export const activitySnapshot=()=>snapshot;
const empty:CollectionActivity[]=[];
export const serverActivitySnapshot=()=>empty;
export function subscribeActivity(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(){for(const listener of listeners)listener();}
function update(id:number,patch:Partial<CollectionActivity>){snapshot=snapshot.map(x=>x.id===id?{...x,...patch}:x);publish();}
export function clearFinishedActivity(){snapshot=snapshot.filter(x=>!x.finishedAt);publish();}
export const collectionSourceNames:Record<string,string>={repeaters:'Local radio repeaters',resources:'OpenStreetMap places',parcels:'County property records','311':'Austin 311 reports',traffic:'Austin traffic incidents',fire:'Austin fire incidents',crime:'Austin crime reports',fema:'FEMA floodplains',modeled:'Austin modeled floodplains',crossings:'Texas crossing inventory',poweroutages:'Power outages',wildfires:'Wildfire incidents',closurestatus:'Road crossing status',watergauges:'Stream & rainfall gauges',risktracts:'FEMA hazard profiles',firestations:'Fire stations',emsstations:'EMS stations',esd:'Emergency service districts',water:'Water service boundaries',sewer:'Wastewater service boundaries'};
const endpoints:Record<string,string>={'/api/community':'Community & news feeds','/api/civic':'Civic calendars','/api/conditions':'Weather & local conditions','/api/hazards':'Hazard profiles','/api/air-quality':'Air quality','/api/jurisdictions':'Government jurisdictions','/api/lifelines':'Utility advisories','/api/location-context':'County & school geography','/api/address':'Address lookup','/api/road-routes':'Road routes','/api/route-corridor':'Route corridor'};
export function activityName(input:RequestInfo|URL){const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;const url=new URL(value,'http://localhost');if(url.origin!=='http://localhost'&&(typeof location==='undefined'||url.origin!==location.origin))return null;return url.pathname==='/api/data'?(collectionSourceNames[url.searchParams.get('kind')||'']||'Area data'):endpoints[url.pathname]||null;}
// Track JSON consumption without cloning large parcel responses or changing fetch semantics.
export async function collectionFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const name=activityName(input);if(!name)return fetch(input,init);
 const id=++next;const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;const cacheOnly=new URL(value,'http://localhost').searchParams.get('cacheOnly')==='1';
 snapshot=[...snapshot.filter(x=>!x.finishedAt||Date.now()-x.finishedAt<300000).slice(-59),{id,name,phase:'requesting',startedAt:Date.now(),detail:cacheOnly?'Checking overlapping-area cache':'Waiting for source response'}];publish();
 const finish=(phase:Phase,detail:string)=>update(id,{phase,detail,finishedAt:Date.now()});
 try{const response=await fetch(input,init);update(id,{phase:'reading',detail:'Reading source response'});const json=response.json.bind(response);
 response.json=async()=>{try{const data=await json();if(!response.ok||data?.error){finish('error',typeof data?.error==='string'?data.error:'Source request failed');return data;}
 const issues=[...(data?.sources||[]),...(data?.feeds||[])].filter((x:any)=>x.error||x.stale);const warning=!!(data?.partial||data?.stale||data?.warning||issues.length);
 const count=Array.isArray(data?.rows)?data.rows.length:undefined;
 finish(warning?'warning':'complete',data?.unsupported?'No connected source for this area':data?.warning|| (warning?'Some data is incomplete, stale or unavailable':count!==undefined?`${count.toLocaleString()} records · ${cacheOnly||data.cached?'cache checked':'response loaded'}`:cacheOnly?'Cache checked':'Response loaded'));return data;
 }catch(error){finish(error instanceof Error&&error.name==='AbortError'?'cancelled':'error',error instanceof Error?error.message:'Response could not be read');throw error;}};
 // Some callers reject HTTP errors before reading their JSON body.
 if(!response.ok)finish('error',`Source returned HTTP ${response.status}`);
 return response;
 }catch(error){finish(error instanceof Error&&error.name==='AbortError'?'cancelled':'error',error instanceof Error&&error.name==='AbortError'?'Cancelled after navigation or area change':error instanceof Error?error.message:'Source request failed');throw error;}
}
