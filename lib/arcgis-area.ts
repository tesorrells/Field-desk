import type {ParcelGeometry} from './geo';
export type ArcgisFeature={properties:Record<string,unknown>,geometry:ParcelGeometry|{type:'Point',coordinates:number[]}};
type SourceRow={id:string;lat:number;lng:number};
import type {Bounds} from './area-cache';
export async function arcgisArea(url:string,bbox:Bounds,fields:string,request:typeof fetch=fetch,where='1=1'){
 const features:ArcgisFeature[]=[];let complete=false;
 for(let offset=0;offset<4000;offset+=1000){
  const u=new URL(url+'/query');u.search=new URLSearchParams({f:'geojson',where,outFields:fields,returnGeometry:'true',outSR:'4326',inSR:'4326',geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',spatialRel:'esriSpatialRelIntersects',orderByFields:'OBJECTID ASC',resultOffset:String(offset),resultRecordCount:'1000',geometryPrecision:'6'}).toString();
  const r=await request(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Official GIS returned HTTP '+r.status);const d=await r.json() as {error?:unknown;features?:ArcgisFeature[];exceededTransferLimit?:boolean;properties?:{exceededTransferLimit?:boolean}};if(d.error||!Array.isArray(d.features))throw Error('Official GIS records unavailable');features.push(...d.features);
  if(!(d.exceededTransferLimit||d.properties?.exceededTransferLimit)){complete=true;break;}
 }
 let updatedDate:string|undefined;try{const r=await request(url+'?f=json',{signal:AbortSignal.timeout(10000)});const d=await r.json() as {editingInfo?:{dataLastEditDate?:number}};const n=d.editingInfo?.dataLastEditDate;if(r.ok&&typeof n==='number'&&Number.isFinite(n)&&n>0)updatedDate=new Date(n).toISOString();}catch{/* Records remain usable without a layer-edit timestamp. */}
 return {features,complete,updatedDate,limit:4000,fetchedAt:new Date().toISOString()};
}
export async function combineSources(tasks:{name:string,run:()=>Promise<{rows:SourceRow[],complete:boolean,limit:number,fetchedAt:string}>}[]){
 const results=await Promise.allSettled(tasks.map(t=>t.run()));const rows:SourceRow[]=[];const warnings:string[]=[];let complete=true;
 results.forEach((r,i)=>{if(r.status==='fulfilled'){rows.push(...r.value.rows);complete&&=r.value.complete;}else{complete=false;warnings.push(tasks[i].name+': '+(r.reason instanceof Error?r.reason.message:'unavailable'));}});
 if(!tasks.length)throw Error('No connected county source pack for this area');
 if(results.every(r=>r.status==='rejected'))throw Error(warnings.join(' '));
 return {rows:[...new Map(rows.map(r=>[r.id,r])).values()],complete,limit:4000*tasks.length,fetchedAt:new Date().toISOString(),provider:tasks.map(t=>t.name).join(' / '),warning:warnings.join(' ')||undefined};
}
