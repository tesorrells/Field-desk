import type {Bounds} from './area-cache';
export const crossingApi='https://api.atxfloods.com/api/crossings';
export type CrossingStatus={reported:string;state:'Closed'|'Caution'|'Open'|'Unknown';jurisdiction:string;address:string;comment:string;recordUpdated:string|null};
export type CrossingRecord={id:string;name:string;lat:number;lng:number;category:string;source:string;url:string;detail:string;closure:CrossingStatus;retrievedAt?:string;stale?:boolean};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export function crossingRow(p:Record<string,unknown>):CrossingRecord{
 const lat=Number(p.lat),lng=Number(p.lon),id=p.id;
 if(!Number.isSafeInteger(id)||Number(id)<1||![p.lat,p.lon].every(v=>typeof v==='number'||typeof v==='string'&&v.trim()!=='')||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Invalid ATXFloods crossing record.');
 const reported=text(p.status)||'Not supplied',state=({'closed':'Closed','caution':'Caution','open':'Open'} as const)[reported.toLowerCase() as 'closed'|'caution'|'open']||'Unknown',updated=text(p.updated_at);
 const closure:CrossingStatus={reported,state,jurisdiction:text(p.jurisdiction),address:text(p.address),comment:text(p.comment),recordUpdated:updated&&Number.isFinite(Date.parse(updated))?updated:null};
 return {id:'atxfloods:'+id,name:text(p.name)||'Crossing '+id,lat,lng,category:'Crossing status',source:'ATXFloods crossing status',url:'https://www.atxfloods.com/',closure,detail:[closure.address,'Reported status: '+reported,'Source record updated: '+(closure.recordUpdated||'Unavailable'),'Jurisdiction code: '+(closure.jurisdiction||'Unavailable'),closure.comment&&'Source comment (may describe an earlier condition): '+closure.comment,'Record update is not a confirmed inspection or status-change time. Verify current conditions with the responsible agency.'].filter(Boolean).join('\n')};
}
export async function fetchCrossingStatuses(request:typeof fetch=fetch){
 const r=await request(crossingApi,{redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('ATXFloods returned HTTP '+r.status);
 const body=await r.text();if(body.length>8000000)throw Error('ATXFloods exceeds collection limit.');
 const d=JSON.parse(body) as {status:number;totalResult:number;attributes:Record<string,unknown>[]};
 if(d.status!==200||!Array.isArray(d.attributes)||!Number.isSafeInteger(d.totalResult)||d.totalResult!==d.attributes.length||d.totalResult>10000)throw Error('ATXFloods returned incomplete or invalid records.');
 const seen=new Set<string>(),rows=d.attributes.map(crossingRow);for(const row of rows){if(seen.has(row.id))throw Error('ATXFloods returned duplicate identifiers.');seen.add(row.id);}
 return {rows:rows.filter(p=>p.lat>=29.5&&p.lat<=31&&p.lng>=-98.5&&p.lng<=-96.5),complete:true,limit:10000,fetchedAt:new Date().toISOString(),provider:'ATXFloods public API'};
}
export function crossingBounds(rows:CrossingRecord[],b:Bounds){return rows.filter(p=>p.lat>=b[0]&&p.lat<=b[2]&&p.lng>=b[1]&&p.lng<=b[3]);}
