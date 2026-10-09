import {cachedCondition} from '../../../lib/conditions-storage';
import {fetchRadar,fetchMapAlerts,scopeMapAlerts,validWeatherBounds,type AlertFeed} from '../../../lib/weather-map';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get('kind');
 if(kind==='radar'){const radar=await cachedCondition('weather-map-radar-v1',300000,()=>fetchRadar());return Response.json({radar,warning:radar.error||radar.cacheWarning},{headers:{'Cache-Control':'no-store'}});}
 if(kind!=='alerts')return Response.json({error:'Unknown weather layer.'},{status:400});
 const bbox=(p.get('bbox')||'').split(',').map(Number);if(!validWeatherBounds(bbox))return Response.json({error:'Invalid weather map bounds.'},{status:400});
 const snapshot=await cachedCondition('weather-map-nws-land-v1',120000,()=>fetchMapAlerts());
 const alerts={...snapshot,data:snapshot.data?scopeMapAlerts(snapshot.data as AlertFeed,bbox):undefined};
 return Response.json({alerts,warning:alerts.error||alerts.cacheWarning||(alerts.data?.invalid?'Some malformed alert polygons were excluded.':undefined)},{headers:{'Cache-Control':'no-store'}});
}
