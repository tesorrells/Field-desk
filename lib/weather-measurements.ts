import type {Bounds} from './area-cache';
import {validPoint} from './location-core';
import {weatherJson,validWeatherBounds} from './weather-map';
export const rainfallService='https://mapservices.weather.noaa.gov/raster/rest/services/obs/rfc_qpe/MapServer';
export const rainPeriods=[{key:'1h',name:'Last 1 hour',layer:5},{key:'6h',name:'Last 6 hours',layer:17},{key:'24h',name:'Last 24 hours',layer:25},{key:'3d',name:'Last 3 analysis days',layer:37},{key:'7d',name:'Last 7 analysis days',layer:53}];
export type StationReading={id:string;name:string;lat:number;lng:number;observedAt?:string;receivedAt?:string;temperatureF?:number;dewpointF?:number;humidityEstimate?:number;windMph?:number;gustMph?:number;direction?:number|'Variable';raw:string;url:string};
export type StationFeed={rows:StationReading[];partial:boolean;invalid:number};
export type RainfallImage={url:string;bounds:[[number,number],[number,number]];period:string;references:{name:string;referenceAt?:string;ingestedAt?:string}[];legend:{label:string;image:string}[];warning?:string};
const num=(v:any,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:undefined;
const iso=(v:any)=>typeof v==='number'&&v>0&&Number.isFinite(v)&&v<8640000000000000?new Date(v).toISOString():undefined;
export const rainSourceOld=(r:RainfallImage,now=Date.now())=>r.references.some(ref=>!ref.referenceAt||!Number.isFinite(Date.parse(ref.referenceAt))||now-Date.parse(ref.referenceAt)>(r.period.endsWith('h')?10800000:172800000)||Date.parse(ref.referenceAt)>now+600000);
export const stationStale=(s:StationReading,now=Date.now())=>!s.observedAt||now-Date.parse(s.observedAt)>7200000||Date.parse(s.observedAt)>now+600000;
export function stationBounds(b:Bounds):Bounds{const size=.25;return [Math.max(-90,Math.floor(b[0]/size)*size),Math.max(-180,Math.floor(b[1]/size)*size),Math.min(90,Math.ceil(b[2]/size)*size),Math.min(180,Math.ceil(b[3]/size)*size)];}
export function validStationBounds(b:Bounds){return validWeatherBounds(b)&&(b[2]-b[0])*(b[3]-b[1])<=25;}
export function parseStations(data:any,bbox:Bounds):StationFeed{
 if(!Array.isArray(data)||data.length>400)throw Error('Weather station response invalid or exceeds its 400-report limit.');
 const byId=new Map<string,StationReading>();let invalid=0;
 for(const x of data){if(!x||typeof x.icaoId!=='string'||!/^\w{3,8}$/.test(x.icaoId)||typeof x.lat!=='number'||typeof x.lon!=='number'||!validPoint(x.lat,x.lon)){invalid++;continue;}if(x.lat<bbox[0]||x.lat>bbox[2]||x.lon<bbox[1]||x.lon>bbox[3])continue;
  const temp=num(x.temp,-90,60),dew=num(x.dewp,-90,60),speed=num(x.wspd,0,250),gust=num(x.wgst,0,250);
  const humidityEstimate=temp!==undefined&&dew!==undefined&&temp>=-80&&dew>=-80&&dew<=temp?Math.round(100*Math.exp(17.625*dew/(243.04+dew)-17.625*temp/(243.04+temp))):undefined;
  const reading:StationReading={id:x.icaoId,name:typeof x.name==='string'?x.name.slice(0,250):x.icaoId,lat:x.lat,lng:x.lon,observedAt:iso(typeof x.obsTime==='number'?x.obsTime*1000:undefined),receivedAt:typeof x.receiptTime==='string'&&Number.isFinite(Date.parse(x.receiptTime))?x.receiptTime:undefined,temperatureF:temp!==undefined?temp*9/5+32:undefined,dewpointF:dew!==undefined?dew*9/5+32:undefined,humidityEstimate,windMph:speed!==undefined?speed*1.150779448:undefined,gustMph:gust!==undefined?gust*1.150779448:undefined,direction:x.wdir==='VRB'?'Variable':num(x.wdir,0,360),raw:typeof x.rawOb==='string'?x.rawOb.slice(0,2000):'',url:'https://aviationweather.gov/api/data/metar?'+new URLSearchParams({ids:x.icaoId,format:'json'})};
  const prior=byId.get(reading.id);if(!prior||Date.parse(reading.observedAt||'')>Date.parse(prior.observedAt||'')||!prior.observedAt&&reading.observedAt)byId.set(reading.id,reading);
 }
 return {rows:[...byId.values()].sort((a,b)=>a.id.localeCompare(b.id)),partial:data.length>=400||invalid>0,invalid};
}
export async function fetchStations(bbox:Bounds,fetcher:typeof fetch=fetch){
 if(!validStationBounds(bbox))throw Error('Zoom in to a local or regional view to load weather stations.');
 const url='https://aviationweather.gov/api/data/metar?'+new URLSearchParams({bbox:bbox.join(','),format:'json'});
 const r=await fetcher(url,{redirect:'manual',headers:{Accept:'application/json','User-Agent':'FieldDesk/1.0 (local weather observations)'},signal:AbortSignal.timeout(20000)});
 if(r.status===204)return {rows:[],partial:false,invalid:0};if(!r.ok)throw Error(`Weather stations returned HTTP ${r.status}`);const text=await r.text();if(text.length>2000000)throw Error('Station response exceeds size limit.');return parseStations(JSON.parse(text),bbox);
}
function check(data:any){if(data?.error)throw Error('NOAA rainfall service: '+(data.error.message||'request failed'));return data;}
export function rainExportParams(bbox:Bounds,period:string){const p=rainPeriods.find(p=>p.key===period);if(!p||!validWeatherBounds(bbox)||bbox[0]<-85||bbox[2]>85)throw Error('Choose a rainfall period and a map view between 85° south and north.');return new URLSearchParams({bbox:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),bboxSR:'4326',imageSR:'3857',size:'768,768',format:'png32',transparent:'true',layers:'show:'+(p.layer+3)});}
export function parseRainfall(exported:any,footprint:any,legend:any,bbox:Bounds,period:string):RainfallImage{
 check(exported);check(footprint);check(legend);const p=rainPeriods.find(p=>p.key===period);if(!p)throw Error('Unknown rainfall period.');
 const e=exported?.extent,sr=e?.spatialReference?.latestWkid||e?.spatialReference?.wkid;if(!e||![3857,102100].includes(sr)||[e.xmin,e.ymin,e.xmax,e.ymax].some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>21000000)||e.xmin>=e.xmax||e.ymin>=e.ymax)throw Error('Rainfall image extent unavailable.');
 const point=(x:number,y:number):[number,number]=>[(2*Math.atan(Math.exp(y/6378137))-Math.PI/2)*180/Math.PI,x/6378137*180/Math.PI];
 if(!Array.isArray(footprint?.features)||footprint.exceededTransferLimit||footprint.features.length>20)throw Error('Rainfall source reference metadata is incomplete.');
 const entries=legend?.layers?.find((l:any)=>l.layerId===p.layer+3)?.legend;if(!Array.isArray(entries)||!entries.length||entries.length>50)throw Error('Rainfall legend unavailable.');
 const sw=point(e.xmin,e.ymin),ne=point(e.xmax,e.ymax);
 const params=rainExportParams(bbox,period);params.set('f','image');
 return {url:rainfallService+'/export?'+params,bounds:[sw,ne],period,references:footprint.features.map((f:any)=>({name:typeof f.attributes?.name==='string'?f.attributes.name.slice(0,200):'Unnamed source grid',referenceAt:iso(f.attributes?.idp_issueddate),ingestedAt:iso(f.attributes?.idp_ingestdate)})),legend:entries.map((e:any)=>{if(e.contentType!=='image/png'||typeof e.imageData!=='string'||e.imageData.length>8000||!/^iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(e.imageData))throw Error('Rainfall legend image invalid.');return {label:typeof e.label==='string'?e.label.slice(0,100):'Unknown class',image:'data:image/png;base64,'+e.imageData};}),warning:footprint.features.length?undefined:'No rainfall reference grid intersects this view; imagery may have no coverage.'};
}
export async function fetchRainfall(bbox:Bounds,period:string,fetcher:typeof fetch=fetch){
 const p=rainPeriods.find(p=>p.key===period);const params=rainExportParams(bbox,period);params.set('f','json');
 const query=new URLSearchParams({f:'json',where:'1=1',geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outFields:'name,idp_issueddate,idp_ingestdate',returnGeometry:'false',resultRecordCount:'20'});
 const [image,reference,legend]=await Promise.all([weatherJson(rainfallService+'/export?'+params,fetcher),weatherJson(rainfallService+'/'+(p!.layer+2)+'/query?'+query,fetcher),weatherJson(rainfallService+'/legend?f=json',fetcher)]);
 return parseRainfall(image,reference,legend,bbox,period);
}
