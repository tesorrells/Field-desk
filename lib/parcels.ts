import {packsForArea} from './local-source-packs';
import {fetchHaysParcels} from './hays-data';
import {combineSources} from './arcgis-area';
import type {ParcelGeometry} from './geo';
import type {Bounds} from './area-cache';
export const parcelSource='https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD/MapServer/0';
export function parcelRow(f:any){
 const g=f.geometry as ParcelGeometry,p=f.properties;
 if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!p||(!Number.isFinite(p.PROP_ID)&&!Number.isFinite(p.OBJECTID)))throw new Error('Parcel source returned an invalid record.');
 const vertices=(g.type==='Polygon'?[g.coordinates]:g.coordinates).flatMap(r=>r[0]) as number[][];if(!vertices.length||vertices.some(v=>!Number.isFinite(v[0])||!Number.isFinite(v[1])))throw new Error('Parcel source returned invalid coordinates.');
 const xs=vertices.map(v=>v[0]),ys=vertices.map(v=>v[1]);const num=(v:any)=>v===null||v===undefined||v===''?undefined:Number.isFinite(Number(v))?Number(v):undefined;
 let url='https://traviscad.org/propertysearch';try{const u=new URL(p.hyperlink);if(u.protocol==='https:'&&['stage.travis.prodigycad.com','travis.prodigycad.com'].includes(u.hostname))url=u.toString();}catch{}
 return {id:Number.isFinite(p.PROP_ID)?'tcad:'+p.PROP_ID:'tcad:object:'+p.OBJECTID,name:p.situs_address?.trim()||(Number.isFinite(p.PROP_ID)?`Parcel ${p.PROP_ID}`:'Parcel · property ID unavailable'),lat:(Math.min(...ys)+Math.max(...ys))/2,lng:(Math.min(...xs)+Math.max(...xs))/2,category:'Property records',source:'Travis County parcels',geometry:g,url,property:{id:Number.isFinite(p.PROP_ID)?String(p.PROP_ID):'Unavailable',geoId:p.geo_id,owner:p.py_owner_name,address:p.situs_address,city:p.situs_city,zip:p.situs_zip,acres:num(p.tcad_acres),landUse:p.land_type_desc,yearBuilt:num(p.F1year_imprv),marketValue:num(p.market_value),appraisedValue:num(p.appraised_val),assessedValue:num(p.assessed_val),legal:p.legal_desc,subdivision:p.sub_dec,deedNumber:p.deed_num,deedBook:p.deed_book_id,deedPage:p.deed_book_page,deedDate:typeof p.deed_date==='number'?new Date(p.deed_date).toISOString().slice(0,10):undefined,appraisalYear:null}};
}
async function fetchTravisParcels(bbox:Bounds,request:typeof fetch=fetch){
 const rows:any[]=[];let complete=false;const limit=4000;
 for(let offset=0;offset<limit;offset+=1000){const u=new URL(parcelSource+'/query');u.search=new URLSearchParams({f:'geojson',where:'1=1',geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,PROP_ID,geo_id,situs_address,situs_city,situs_zip,tcad_acres,land_type_desc,F1year_imprv,market_value,appraised_val,assessed_val,py_owner_name,legal_desc,sub_dec,deed_num,deed_book_id,deed_book_page,deed_date,hyperlink',returnGeometry:'true',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:'1000',geometryPrecision:'6'}).toString();
 const r=await request(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Travis County parcels returned HTTP ${r.status}`);const d:any=await r.json();if(d.error||!Array.isArray(d.features))throw new Error('Travis County parcel service could not return records.');rows.push(...d.features.map(parcelRow));if(!(d.exceededTransferLimit||d.properties?.exceededTransferLimit)){complete=true;break;}
 }
 return {rows:[...new Map(rows.map(r=>[r.id,r])).values()],complete,limit,fetchedAt:new Date().toISOString(),provider:'Travis County / TCAD'};
}

export async function fetchParcels(bbox:Bounds,request:typeof fetch=fetch){return combineSources(packsForArea(bbox).map(p=>({name:p.name+' parcels',run:()=>p.id==='hays'?fetchHaysParcels(bbox,request):fetchTravisParcels(bbox,request)})));}
