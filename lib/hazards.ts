import type {Bounds} from './area-cache';
import type {ParcelGeometry} from './geo';
export const nriRoot='https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/';
export const nriSources={county:{service:'National_Risk_Index_Counties',item:'39485e8035d446a5bff03259508ae355'},tract:{service:'National_Risk_Index_Census_Tracts',item:'9da4eeb936544335a6db0cd7a8448a51'}};
export const hazardNames:Record<string,string>={AVLN:'Avalanche',CFLD:'Coastal flooding',CWAV:'Cold wave',DRGT:'Drought',ERQK:'Earthquake',HAIL:'Hail',HWAV:'Heat wave',HRCN:'Hurricane',ISTM:'Ice storm',IFLD:'Inland flooding',LNDS:'Landslide',LTNG:'Lightning',SWND:'Strong wind',TRND:'Tornado',TSUN:'Tsunami',VLCN:'Volcanic activity',WFIR:'Wildfire',WNTW:'Winter weather'};
export type HazardMetric={code:string;name:string;score:number|null;rating:string;expectedAnnualLoss:number|null};
export type NriProfile={id:string;level:'county'|'tract';county:string;countyFips:string;tractFips:string;version:string;catalogUpdatedAt:string|null;url:string;hazards:HazardMetric[]};
export type NriRecord={id:string;name:string;lat:number;lng:number;category:string;source:string;url:string;detail:string;geometry:ParcelGeometry;risk:NriProfile;retrievedAt?:string;stale?:boolean};
type NriFeature={properties:Record<string,unknown>;geometry:ParcelGeometry};
type QueryResult={features:NriFeature[];error?:unknown;exceededTransferLimit?:boolean;properties?:{exceededTransferLimit?:boolean}};
type Catalog={owner?:string;modified?:number;url?:string};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export function metricNumber(v:unknown,max=Infinity){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;}
export function nriRow(f:NriFeature,level:'county'|'tract',catalogUpdatedAt:string|null):NriRecord{
 const p=f.properties,g=f.geometry,id=text(p?.NRI_ID),countyFips=text(p?.STCOFIPS),tractFips=text(p?.TRACTFIPS),version=text(p?.NRI_VER);
 if(!p||!id||!/^\d{5}$/.test(countyFips)||(level==='tract'&&!/^\d{11}$/.test(tractFips))||!version||!g||!['Polygon','MultiPolygon'].includes(g.type))throw Error('FEMA returned an invalid US risk profile.');
 const rings=(g.type==='Polygon'?[g.coordinates]:g.coordinates) as number[][][][],coords=rings.flatMap(poly=>poly.flat());
 if(!coords.length||coords.some(c=>!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90))throw Error('FEMA profile geometry is unavailable.');
 const b=coords.reduce((a,c)=>[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[2],c[0]),Math.max(a[3],c[1])],[Infinity,Infinity,-Infinity,-Infinity]);
 const hazards=Object.entries(hazardNames).map(([code,name])=>({code,name,score:metricNumber(p[code+'_RISKS'],100),rating:text(p[code+'_RISKR'])||'Unavailable',expectedAnnualLoss:metricNumber(p[code+'_EALT'])}));
 if(!hazards.some(h=>h.score!==null))throw Error('FEMA hazard scores are unavailable for this profile.');
 const url=nriRoot+nriSources[level].service+'/FeatureServer/0',risk:NriProfile={id,level,county:text(p.COUNTY),countyFips,tractFips,version,catalogUpdatedAt,url,hazards};
 const name=level==='county'?`${risk.county} County · FEMA risk profile`:`Census tract ${tractFips} · FEMA risk profile`;
 return {id:'nri:'+id,name,lat:(b[1]+b[3])/2,lng:(b[0]+b[2])/2,geometry:g,category:'Hazard profiles',source:level==='county'?'FEMA county risk profiles':'FEMA tract risk profiles',url,risk,detail:[`FEMA NRI release: ${version}`,`Geography: ${level==='county'?risk.county+' County':tractFips+' census tract'}; county FIPS ${countyFips}`,`Catalog updated: ${catalogUpdatedAt||'Unavailable'}`,`National relative risk scores compare ${level==='county'?'counties':'census tracts'}; not probabilities or current alerts.`,...hazards.map(h=>`${h.name}: ${h.score===null?'score unavailable':h.score.toFixed(1)+'/100'} · ${h.rating}`)].join('\n')};
}
async function json(url:URL|string,request:typeof fetch){const r=await request(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`FEMA risk source returned HTTP ${r.status}`);const body=await r.text();if(body.length>4000000)throw Error('FEMA response exceeds the profile collection limit.');return JSON.parse(body);}
async function catalog(level:'county'|'tract',request:typeof fetch){const source=nriSources[level],d=await json(`https://www.arcgis.com/sharing/rest/content/items/${source.item}?f=json`,request) as Catalog;if(d.owner!=='FEMA_NationalRiskIndex'||d.url!==nriRoot+source.service+'/FeatureServer')throw Error('FEMA source metadata could not be verified.');return typeof d.modified==='number'&&Number.isFinite(d.modified)?new Date(d.modified).toISOString():null;}
const fields=['NRI_ID','NRI_VER','COUNTY','STCOFIPS','TRACTFIPS',...Object.keys(hazardNames).flatMap(c=>[c+'_RISKS',c+'_RISKR',c+'_EALT'])];
export async function fetchRiskArea(bbox:Bounds,request:typeof fetch=fetch){
 const updated=await catalog('tract',request),rows:NriRecord[]=[];let complete=false;
 for(let offset=0;offset<500;offset+=100){const u=new URL(nriRoot+nriSources.tract.service+'/FeatureServer/0/query');u.search=new URLSearchParams({f:'geojson',where:"1=1",geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:fields.join(','),geometryPrecision:'6',resultOffset:String(offset),resultRecordCount:'100',orderByFields:'OBJECTID ASC'}).toString();const d=await json(u,request) as QueryResult;if(d.error||!Array.isArray(d.features))throw Error('FEMA could not return area risk profiles.');rows.push(...d.features.map(f=>nriRow(f,'tract',updated)));if(!(d.exceededTransferLimit||d.properties?.exceededTransferLimit)){complete=true;break;}}
 return {rows,complete,limit:500,fetchedAt:new Date().toISOString(),provider:'FEMA National Risk Index'};
}
export async function collectHomeRisk(level:'county'|'tract',point:[number,number]|null,request:typeof fetch=fetch){
 const updated=await catalog(level,request),u=new URL(nriRoot+nriSources[level].service+'/FeatureServer/0/query');
 const query:Record<string,string>={f:'geojson',where:point?"1=1":"STCOFIPS = '48453'",outFields:fields.filter(f=>level==='tract'||f!=='TRACTFIPS').join(','),outSR:'4326',geometryPrecision:'6',resultRecordCount:'10'};
 if(point)Object.assign(query,{geometry:[point[1],point[0]].join(','),geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects'});
 u.search=new URLSearchParams(query).toString();const d=await json(u,request) as QueryResult;if(d.error||!Array.isArray(d.features)||d.exceededTransferLimit||d.properties?.exceededTransferLimit)throw Error('FEMA could not resolve this location’s risk profiles.');if(!d.features.length)throw Error('No FEMA profile matched this point; check the source boundary.');return d.features.map(f=>nriRow(f,level,updated));
}
