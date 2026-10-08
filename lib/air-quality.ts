export const airFile='https://files.airnowtech.org/airnow/today/reportingarea.dat';
export type AirReading={pollutant:string;aqi:number|null;category:string;observedAt:string;localTime:string;agency:string;primary:boolean};
export type AirData={area:string;readings:AirReading[]};
export function parseAirNow(body:string):AirData{
 const rows=new Map<string,AirReading>();let records=0;
 for(const line of body.split(/\r?\n/)){if(!line.trim())continue;const c=line.trim().split('|');if(c.length!==17)throw Error('AirNow file format changed or is incomplete');records++;if(c[7]!=='Austin'||c[8]!=='TX'||c[5]!=='O')continue;
 const m=/^(\d{2})\/(\d{2})\/(\d{2})$/.exec(c[1]),h=/^(\d{2}):(\d{2})$/.exec(c[2]),offset=({CST:'-06:00',CDT:'-05:00'} as Record<string,string>)[c[3]];
 if(!m||!h||!offset||Number(h[1])>23||Number(h[2])>59)throw Error('AirNow observation time unavailable');
 if(Number(m[1])<1||Number(m[1])>12||Number(m[2])<1||Number(m[2])>new Date(Date.UTC(2000+Number(m[3]),Number(m[1]),0)).getUTCDate())throw Error('Invalid AirNow observation date');
 const iso='20'+m[3]+'-'+m[1]+'-'+m[2]+'T'+c[2]+':00'+offset,time=Date.parse(iso);if(!Number.isFinite(time))throw Error('Invalid AirNow observation date');
 const raw=c[12].trim(),num=raw?Number(raw):NaN,reading:AirReading={pollutant:c[11],aqi:Number.isInteger(num)&&num>=0&&num<=500?num:null,category:c[13]||'Unavailable',observedAt:new Date(time).toISOString(),localTime:c[1]+' '+c[2]+' '+c[3],agency:c[16],primary:c[6]==='Y'};
 const prior=rows.get(reading.pollutant);if(!prior||Date.parse(prior.observedAt)<time)rows.set(reading.pollutant,reading);
 }
 if(records<100||!rows.size)throw Error('Austin AirNow observations unavailable or file incomplete');
 return {area:'Austin reporting area, TX',readings:[...rows.values()]};
}
export async function fetchAirNow(request:typeof fetch=fetch){const r=await request(airFile,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('AirNow returned HTTP '+r.status);const t=await r.text();if(t.length>8000000)throw Error('AirNow file exceeds limit');return parseAirNow(t);}
export const aqiColors:Record<string,{background:string;color:string}>={'Good':{background:'#00e400',color:'#111'},'Moderate':{background:'#ffff00',color:'#111'},'Unhealthy for Sensitive Groups':{background:'#ff7e00',color:'#111'},'Unhealthy':{background:'#ff0000',color:'#fff'},'Very Unhealthy':{background:'#8f3f97',color:'#fff'},'Hazardous':{background:'#7e0023',color:'#fff'}};
