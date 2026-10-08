import type {Bounds} from './area-cache';
export const wildfireLayer='https://services3.arcgis.com/T4QMspbfLg3qTGWY/ArcGIS/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0';
export type WildfireData={type:string;acres:number|null;contained:number|null;discovered:string|null;updated:string|null;county:string;agency:string};
export type WildfireRecord={id:string;name:string;lat:number;lng:number;category:string;source:string;url:string;detail:string;wildfire:WildfireData;retrievedAt?:string;stale?:boolean};
const clean=(v:unknown)=>typeof v==='string'?v.trim():'';
const date=(v:unknown)=>typeof v==='number'&&v>0&&Number.isFinite(v)?new Date(v).toISOString():null;
const measure=(v:unknown,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
export function fireBounds(b:Bounds):Bounds{const p:Bounds=[Math.max(-90,b[0]-.2),Math.max(-180,b[1]-.2),Math.min(90,b[2]+.2),Math.min(180,b[3]+.2)];return (p[2]-p[0])*(p[3]-p[1])<=.7?p:b;}
export function wildfireRow(f:{properties:Record<string,unknown>;geometry:{type:string;coordinates:number[]}}):WildfireRecord{
 const p=f.properties,g=f.geometry,id=clean(p.IrwinID),type=clean(p.IncidentTypeCategory);
 if(!id||!['WF','RX','CX'].includes(type)||g?.type!=='Point'||!Number.isFinite(g.coordinates[0])||!Number.isFinite(g.coordinates[1])||Math.abs(g.coordinates[0])>180||Math.abs(g.coordinates[1])>90)throw Error('Invalid NIFC incident record.');
 const wildfire:WildfireData={type:({WF:'Wildfire',RX:'Prescribed fire',CX:'Incident complex'} as Record<string,string>)[type],acres:measure(p.IncidentSize),contained:measure(p.PercentContained,100),discovered:date(p.FireDiscoveryDateTime),updated:date(p.ModifiedOnDateTime_dt),county:clean(p.POOCounty),agency:clean(p.POOProtectingAgency)||clean(p.POOJurisdictionalAgency)};
 return {id:'nifc:'+id,name:clean(p.IncidentName)||'Unnamed incident',lat:g.coordinates[1],lng:g.coordinates[0],category:'Wildfire incidents',source:'NIFC current incidents',url:'https://www.arcgis.com/home/item.html?id=4181a117dc9e43db8598533e29972015',wildfire,detail:[wildfire.type,'Reported acres: '+(wildfire.acres??'Unavailable'),'Reported containment: '+(wildfire.contained===null?'Unavailable':wildfire.contained+'%'),'Discovered: '+(wildfire.discovered||'Unavailable'),'Record updated: '+(wildfire.updated||'Unavailable'),'Point is an incident location, not a fire perimeter, smoke extent or evacuation zone.'].join('\n')};
}
export async function fetchWildfires(bbox:Bounds,request:typeof fetch=fetch){
 const rows:WildfireRecord[]=[];let complete=false;
 for(let offset=0;offset<2500;offset+=500){const u=new URL(wildfireLayer+'/query');u.search=new URLSearchParams({f:'geojson',where:"IncidentTypeCategory IN ('WF','RX','CX')",outFields:'IrwinID,IncidentName,IncidentTypeCategory,IncidentSize,PercentContained,FireDiscoveryDateTime,ModifiedOnDateTime_dt,POOCounty,POOProtectingAgency,POOJurisdictionalAgency',outSR:'4326',geometry:[bbox[1],bbox[0],bbox[3],bbox[2]].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',orderByFields:'OBJECTID',resultRecordCount:'500',resultOffset:String(offset)}).toString();const r=await request(u,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('NIFC returned HTTP '+r.status);const body=await r.text();if(body.length>4000000)throw Error('NIFC response exceeds limit');const d=JSON.parse(body);if(d.error||!Array.isArray(d.features))throw Error('NIFC incident records unavailable');rows.push(...d.features.map(wildfireRow));if(!(d.exceededTransferLimit||d.properties?.exceededTransferLimit)){complete=true;break;}}
 return {rows,complete,limit:2500,fetchedAt:new Date().toISOString(),provider:'NIFC / WFIGS current incident locations'};
}
