import {geometryContains,lineIntersectsGeometry,parcelInBounds,type ParcelGeometry,type Point} from './geo';
import type {Bounds} from './area-cache';
import {weatherJson,weatherPolygon} from './weather-map';
export type OutlookKind='storms'|'rainoutlook';
export type StormHazard='cat'|'torn'|'hail'|'wind';
export type OutlookProduct={kind:OutlookKind;day:number;hazard:StormHazard;key:string;name:string;url:string;officialUrl:string};
export type OutlookArea={id:string;rank:number;label:string;color:string;geometry:ParcelGeometry};
export type OutlookFeed={product:OutlookProduct;rows:OutlookArea[];issuedAt?:string;validFrom?:string;validThrough?:string;sourceMessage?:string;invalid:number;periodKnown:boolean};
export type OutlookLocation={id:string;name:string;home:{point:Point}|null};
export type OutlookRoute={id:string;name:string;points:Point[]};
export const stormHazards:Record<StormHazard,string>={cat:'Overall storm risk',torn:'Tornado probability',hail:'Hail probability',wind:'Damaging-wind probability'};
export const stormClasses=[{rank:2,label:'General thunderstorms',color:'#55bb55'},{rank:3,label:'Marginal',color:'#66a366'},{rank:4,label:'Slight',color:'#ddaa00'},{rank:5,label:'Enhanced',color:'#ff6600'},{rank:6,label:'Moderate',color:'#cc0000'},{rank:8,label:'High',color:'#cc00cc'}];
export const rainClasses=[{rank:1,label:'Marginal · ≥5%',color:'#00a33b'},{rank:2,label:'Slight · ≥15%',color:'#d3aa00'},{rank:3,label:'Moderate · ≥40%',color:'#ee2c2c'},{rank:4,label:'High · ≥70%',color:'#ff00ff'}];
function shapeId(g:ParcelGeometry){let hash=2166136261;const s=JSON.stringify(g);for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);}
export function outlookProduct(kind:OutlookKind,day:number,hazard:StormHazard='cat'):OutlookProduct{
 if(!Number.isInteger(day)||day<1||day>(kind==='storms'?3:5)||!Object.hasOwn(stormHazards,hazard)||kind==='storms'&&day===3&&hazard!=='cat')throw Error('Choose a supported outlook day and hazard.');
 if(kind==='storms')return {kind,day,hazard,key:`storms:${day}:${hazard}`,name:`Day ${day} · ${stormHazards[hazard]}`,url:`https://www.spc.noaa.gov/products/outlook/day${day}otlk_${hazard}.nolyr.geojson`,officialUrl:`https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`};
 if(kind!=='rainoutlook')throw Error('Unknown outlook product.');
 return {kind,day,hazard:'cat',key:`rainoutlook:${day}`,name:`Day ${day} · Excessive rainfall`,url:`https://www.wpc.ncep.noaa.gov/exper/eromap/geojson/Day${day}_Latest.geojson`,officialUrl:'https://www.wpc.ncep.noaa.gov/qpf/excessive_rainfall_outlook_ero.php'};
}
export function outlookTime(value:unknown){if(typeof value!=='string')return undefined;const m=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value)||/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):\d{2}$/.exec(value);if(!m)return undefined;const [y,month,d,h,min]=m.slice(1).map(Number),sec=value.includes(":")?Number(value.slice(-2)):0;if(y<2000||y>2200||h>23||min>59||sec>59)return undefined;const t=new Date(Date.UTC(y,month-1,d,h,min,sec));if(t.getUTCFullYear()!==y||t.getUTCMonth()!==month-1||t.getUTCDate()!==d)return undefined;return t.toISOString();}
export function parseOutlook(data:any,product:OutlookProduct):OutlookFeed{
 if(data?.error||data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>400||data.exceededTransferLimit||data.properties?.exceededTransferLimit)throw Error('Outlook feed invalid, oversized or incomplete.');
 const rows:OutlookArea[]=[],periods=new Set<string>(),messages=new Set<string>(),seen=new Set<string>();let invalid=0,unknownPeriod=false;
 for(const f of data.features){
  const p=f?.properties;if(!p||typeof p!=='object'){invalid++;unknownPeriod=true;continue;}
  const storm=product.kind==='storms',issued=outlookTime(storm?p.ISSUE:p.ISSUE_TIME),start=outlookTime(storm?p.VALID:p.START_TIME),end=outlookTime(storm?p.EXPIRE:p.END_TIME);
  if(!start||!end||Date.parse(start)>=Date.parse(end))unknownPeriod=true;else periods.add(JSON.stringify({issuedAt:issued,validFrom:start,validThrough:end}));
  const rank=storm?p.DN:p.dn,label=storm?(p.LABEL2||p.LABEL):p.OUTLOOK;
  if(rank===0&&typeof label==='string'&&label.trim()){messages.add(label.slice(0,250));continue;}
  const g=weatherPolygon(f.geometry),known=storm?product.hazard==='cat'?stormClasses.some(c=>c.rank===rank):Number.isInteger(rank)&&rank>0&&rank<=100:rainClasses.some(c=>c.rank===rank);
  if(!g||!known||typeof label!=='string'||!label.trim()){invalid++;continue;}
  const fallback=(storm?stormClasses:rainClasses).find(c=>c.rank===rank)?.color||'#8067b3';
  const id=product.key+':'+rank+':'+shapeId(g);if(seen.has(id))continue;seen.add(id);
  rows.push({id,rank,label:label.slice(0,250),color:storm&&/^#[a-f0-9]{6}$/i.test(p.stroke||'')?p.stroke:fallback,geometry:g});
 }
 if(periods.size>1)throw Error('Outlook feed mixes forecast issue times or valid periods; retry after the source update.');
 const period=periods.size===1?JSON.parse([...periods][0]):{};
 return {product,rows:rows.sort((a,b)=>a.rank-b.rank),...period,sourceMessage:[...messages].join('; ')||undefined,invalid,periodKnown:!!period.validFrom&&!unknownPeriod};
}
export async function fetchOutlook(product:OutlookProduct,fetcher:typeof fetch=fetch){return parseOutlook(await weatherJson(product.url,fetcher),product);}
export function outlookExpired(feed:OutlookFeed,now=Date.now()){return !!feed.validThrough&&Date.parse(feed.validThrough)<=now;}
export function outlookRowsInView(feed:OutlookFeed,bbox:Bounds,now=Date.now()){return outlookExpired(feed,now)?[]:feed.rows.filter(r=>parcelInBounds(r.geometry,bbox));}
export function outlookMatches(feed:OutlookFeed,locations:OutlookLocation[],routes:OutlookRoute[],now=Date.now()){
 if(!feed.periodKnown||outlookExpired(feed,now))return {available:false,locations:[],routes:[]};
 const labels=(predicate:(r:OutlookArea)=>boolean)=>[...new Set([...feed.rows].sort((a,b)=>b.rank-a.rank).filter(predicate).map(r=>r.label))];
 return {available:true,locations:locations.filter(l=>l.home).map(l=>({id:l.id,name:l.name,labels:labels(r=>geometryContains(r.geometry,l.home!.point))})),routes:routes.filter(r=>r.points.length>=2).map(route=>({id:route.id,name:route.name,labels:labels(r=>lineIntersectsGeometry(route.points,r.geometry))}))};
}
