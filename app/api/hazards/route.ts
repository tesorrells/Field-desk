import {validPoint} from '../../../lib/location-core';
import {collectHomeRisk} from '../../../lib/hazards';
import {cachedCondition} from '../../../lib/conditions-storage';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,hasPoint=q.has('lat')||q.has('lng'),lat=Number(q.get('lat')),lng=Number(q.get('lng'));
 if(!hasPoint)return Response.json({error:"Set the active location to retrieve its FEMA profiles."},{status:400});
 if(hasPoint&&(!q.has('lat')||!q.has('lng')||!validPoint(lat,lng)))return Response.json({error:'Choose a valid location point.'},{status:400});
 const point:[number,number]|null=hasPoint?[lat,lng]:null,key=point?point.join(','):'default-travis';
 const [county,tract]=await Promise.all([cachedCondition('nri:county:'+key,86400000,()=>collectHomeRisk('county',point)),point?cachedCondition('nri:tract:'+key,86400000,()=>collectHomeRisk('tract',point)):undefined]);
 return Response.json({county,tract},{headers:{'Cache-Control':'no-store'}});
}
