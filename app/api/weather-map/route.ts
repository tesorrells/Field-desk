import {fetchOutlook,outlookProduct,type StormHazard} from '../../../lib/weather-outlooks';
import {fetchHeat,fetchSmoke,fetchAirMonitors,scopeAir} from '../../../lib/weather-environment';
import {fetchStations,stationBounds,validStationBounds,fetchRainfall,rainPeriods} from '../../../lib/weather-measurements';
import {cachedCondition} from '../../../lib/conditions-storage';
import {fetchRadar,fetchMapAlerts,scopeMapAlerts,validWeatherBounds,type AlertFeed} from '../../../lib/weather-map';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get('kind');
 if(kind==='storms'||kind==='rainoutlook'){
 let product;try{product=outlookProduct(kind,Number(p.get('day')||1),(p.get('hazard')||'cat') as StormHazard);}catch(e){return Response.json({error:(e as Error).message},{status:400});}
 const snapshot=await cachedCondition('weather-outlook-v1:'+product.key,600000,()=>fetchOutlook(product));return Response.json({[kind]:snapshot,warning:snapshot.error||snapshot.cacheWarning||(snapshot.data&&!snapshot.data.periodKnown?'Outlook forecast period unknown.':snapshot.data?.invalid?'Outlook polygon coverage incomplete.':undefined)},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind==='radar'){const radar=await cachedCondition('weather-map-radar-v1',300000,()=>fetchRadar());return Response.json({radar,warning:radar.error||radar.cacheWarning},{headers:{'Cache-Control':'no-store'}});}
 if(kind==='heat'||kind==='smoke'||kind==='airquality'){
 const bbox=(p.get('bbox')||'').split(',').map(Number);if(!validWeatherBounds(bbox)||bbox[0]<-85||bbox[2]>85||(bbox[2]-bbox[0])*(bbox[3]-bbox[1])>100)return Response.json({error:'Zoom in to a local or regional weather view.'},{status:400});
 if(kind==='airquality'){const snapshot=await cachedCondition('weather-air-monitors-v1',900000,()=>fetchAirMonitors());const airquality={...snapshot,data:snapshot.data?scopeAir(snapshot.data,bbox):undefined};return Response.json({airquality,warning:airquality.error||airquality.cacheWarning||(airquality.data?.partial?'Monitor display capped at 400; zoom in.':airquality.data?.invalid?'Some malformed monitor records were omitted.':undefined)},{headers:{'Cache-Control':'no-store'}});}
 if(kind==='smoke'){const smoke=await cachedCondition('weather-smoke-v1:'+bbox.join(','),900000,()=>fetchSmoke(bbox));return Response.json({smoke,warning:smoke.error||smoke.cacheWarning||(smoke.data?.invalid?'Some malformed smoke outlines were omitted.':undefined)},{headers:{'Cache-Control':'no-store'}});}
 const day=Number(p.get('day')||1);if(!Number.isInteger(day)||day<1||day>7)return Response.json({error:'Choose a forecast day from 1 to 7.'},{status:400});const heat=await cachedCondition('weather-heat-v1:'+day+':'+bbox.join(','),300000,()=>fetchHeat(bbox,day));return Response.json({heat,warning:heat.error||heat.cacheWarning},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind==='stations'||kind==='rainfall'){
 const bbox=(p.get('bbox')||'').split(',').map(Number);if(!validWeatherBounds(bbox))return Response.json({error:'Invalid weather map bounds.'},{status:400});
 if(kind==='stations'){if(!validStationBounds(bbox))return Response.json({error:'Zoom in to a local or regional view to load stations.'},{status:400});const query=stationBounds(bbox);const snapshot=await cachedCondition('weather-stations-v1:'+query.join(','),600000,()=>fetchStations(query));const stations={...snapshot,data:snapshot.data?{...snapshot.data,rows:snapshot.data.rows.filter((r:any)=>r.lat>=bbox[0]&&r.lat<=bbox[2]&&r.lng>=bbox[1]&&r.lng<=bbox[3])}:undefined};return Response.json({stations,warning:stations.error||stations.cacheWarning||(stations.data?.partial?'Station coverage is capped or incomplete.':undefined)},{headers:{'Cache-Control':'no-store'}});}
 const period=p.get('period')||'24h';if(!rainPeriods.some(r=>r.key===period)||bbox[0]<-85||bbox[2]>85)return Response.json({error:'Choose a valid rainfall period and map view.'},{status:400});const rainfall=await cachedCondition('weather-rainfall-v1:'+period+':'+bbox.join(','),900000,()=>fetchRainfall(bbox,period));return Response.json({rainfall,warning:rainfall.error||rainfall.cacheWarning||rainfall.data?.warning},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind!=='alerts')return Response.json({error:'Unknown weather layer.'},{status:400});
 const bbox=(p.get('bbox')||'').split(',').map(Number);if(!validWeatherBounds(bbox))return Response.json({error:'Invalid weather map bounds.'},{status:400});
 const snapshot=await cachedCondition('weather-map-nws-land-v1',120000,()=>fetchMapAlerts());
 const alerts={...snapshot,data:snapshot.data?scopeMapAlerts(snapshot.data as AlertFeed,bbox):undefined};
 return Response.json({alerts,warning:alerts.error||alerts.cacheWarning||(alerts.data?.invalid?'Some malformed alert polygons were excluded.':undefined)},{headers:{'Cache-Control':'no-store'}});
}
