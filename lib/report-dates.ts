// Socrata floating timestamps preserve the source's calendar and clock fields.
// Do not reinterpret an unzoned timestamp as UTC and shift its displayed date.
export function reportDate(value?:string,withTime=false){
 if(!value)return "Date unavailable";
 const floating=!/(Z|[+-]\d\d:\d\d)$/i.test(value);
 const date=new Date(floating?value+"Z":value);
 if(!Number.isFinite(date.getTime()))return "Date unavailable";
 return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",...(withTime?{hour:"numeric",minute:"2-digit"}:{}),timeZone:floating?"UTC":"America/Chicago"}).format(date);
}
export function reportAgeDays(value?:string,now=new Date()){
 if(!value)return null;
 const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Chicago"}).formatToParts(now);
 const part=(k:string)=>parts.find(p=>p.type===k)?.value;
 const today=Date.parse(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
 let dateKey=value.slice(0,10);
 if(/(Z|[+-]\d\d:\d\d)$/i.test(value)){const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;const bits=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Chicago"}).formatToParts(date);const pick=(k:string)=>bits.find(p=>p.type===k)?.value;dateKey=`${pick("year")}-${pick("month")}-${pick("day")}`;}
 const day=Date.parse(dateKey+"T00:00:00Z");
 return Number.isFinite(day)?Math.max(0,Math.round((today-day)/86400000)):null;
}
export function reportAge(value?:string){const days=reportAgeDays(value);return days===null?"Age unavailable":days===0?"today":days===1?"1 day ago":`${days} days ago`;}
export function isClosed(status?:string){return /closed|cancelled|canceled/i.test(status||"");}
