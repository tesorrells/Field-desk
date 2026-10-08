import {fetchPuc} from './hays-data';
import type {Bounds} from './area-cache';
import type {ParcelGeometry} from './geo';
type CountyFeature={properties:Record<string,unknown>;geometry:{type:'Point';coordinates:number[]}|ParcelGeometry};
export const serviceLayers:Record<string,{path:string;category:string;label:string}>={
 firestations:{path:'Emergency_Services_Fire_EMS_Stations/MapServer/0',category:'Fire stations',label:'Fire stations'},
 emsstations:{path:'Emergency_Services_Fire_EMS_Stations/MapServer/1',category:'EMS stations',label:'EMS stations'},
 esd:{path:'Emergency_Service_Districts_ESDs/MapServer/0',category:'Emergency districts',label:'Emergency service districts'},
 water:{path:'Water_Providers/MapServer/1',category:'Water providers',label:'Water CCN boundaries'},
 sewer:{path:'Water_Providers/MapServer/0',category:'Wastewater providers',label:'Sewer CCN boundaries'},
};
export const serviceRoot='https://gis.traviscountytx.gov/server1/rest/services/Services_and_Facilities/';
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
export function serviceRow(f:CountyFeature,kind:string){
 const layer=serviceLayers[kind],p=f.properties,g=f.geometry;
 if(!layer||!p||!Number.isFinite(p.OBJECTID)||!g)throw Error('Invalid county facility record.');
 const polygon=['Polygon','MultiPolygon'].includes(g.type);
 const coords=g.type==='Point'?[g.coordinates]:g.type==='Polygon'?g.coordinates.flat():g.type==='MultiPolygon'?g.coordinates.flat(2):[];
 if(!coords.length||coords.some(c=>!Array.isArray(c)||!Number.isFinite(c[0])||!Number.isFinite(c[1])))throw Error('Invalid county facility geometry.');
 const bounds=coords.reduce((b,c)=>[Math.min(b[0],c[0]),Math.min(b[1],c[1]),Math.max(b[2],c[0]),Math.max(b[3],c[1])],[Infinity,Infinity,-Infinity,-Infinity]);
 const lng=(bounds[0]+bounds[2])/2,lat=(bounds[1]+bounds[3])/2;
 const name=kind==='firestations'?[clean(p.DEPARTMENT),'Fire station',clean(p.STATION_NU)].filter(Boolean).join(' '):kind==='emsstations'?clean(p.FACILITY_N)||clean(p.BASE_STATI)||'EMS location':kind==='esd'?clean(p.ESD_Name_Full)||clean(p.ESD_Name):clean(p.UTILITY)||'Utility name unavailable';
 const address=clean(p.ADDRESS)||clean(p.Address),phone=clean(p.Phone_Number),ccn=clean(p.CCN_NO);
 const updatedDate=typeof p.MODIFIED_D==='number'?new Date(p.MODIFIED_D).toISOString():undefined;
 const detail=[address,phone&&`Published office phone: ${phone}`,ccn&&`CCN ${ccn}`,kind==='emsstations'&&clean(p.FACILITY_T),polygon?'Published boundary; confirm current service eligibility with the provider.':'Mapped facility; staffing, availability, response time, and current operating status are unavailable.',['water','sewer'].includes(kind)?'County metadata cites a January 9, 2019 CCN dataset. Verify current boundaries in the PUC viewer.':undefined,kind==='esd'?'County layer description cites boundaries obtained in May 2016. Verify current jurisdiction.':undefined].filter(Boolean).join('\n');
 return {id:`county-${kind}:${p.OBJECTID}`,name,lat,lng,category:layer.category,source:`Travis County ${layer.label}`,url:serviceRoot+layer.path,geometry:polygon?g:undefined,detail,updatedDate,status:'Current operating status unavailable'};
}
export async function fetchServices(kind:string,bbox:Bounds,request:typeof fetch=fetch){
 if(kind==='water'||kind==='sewer')return fetchPuc(kind,bbox,request);
 const layer=serviceLayers[kind];if(!layer)throw Error('Unknown county service layer.');
 const rows:ReturnType<typeof serviceRow>[]=[];let complete=false;
 for(let offset=0;offset<4000;offset+=1000){
  const u=new URL(serviceRoot+layer.path+'/query');u.search=new URLSearchParams({f:'geojson',where:'1=1',outFields:'*',outSR:'4326',resultRecordCount:'1000',geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',...(offset?{resultOffset:String(offset)}:{})}).toString();
  const r=await request(u.toString().replaceAll('%2C',','),{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`County ${layer.label} returned HTTP ${r.status}`);const d=await r.json() as {error?:unknown;features:CountyFeature[];exceededTransferLimit?:boolean;properties?:{exceededTransferLimit?:boolean}};if(d.error||!Array.isArray(d.features))throw Error(`County ${layer.label} could not return records.`);
  rows.push(...d.features.map(f=>serviceRow(f,kind)));if(!(d.exceededTransferLimit||d.properties?.exceededTransferLimit)){complete=true;break;}
 }
 return {rows,complete,limit:4000,fetchedAt:new Date().toISOString(),provider:'Travis County GIS'};
}
