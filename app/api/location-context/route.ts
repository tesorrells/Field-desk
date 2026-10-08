import {validPoint} from '../../../lib/location-core';
import {collectLocationGeography} from '../../../lib/location-geography';
import {cachedCondition} from '../../../lib/conditions-storage';
export async function GET(request:Request){const q=new URL(request.url).searchParams,lat=Number(q.get('lat')),lng=Number(q.get('lng'));if(!q.has('lat')||!q.has('lng')||!validPoint(lat,lng))return Response.json({error:'Choose a valid location point'},{status:400});return Response.json(await cachedCondition('location-context:'+lat+','+lng,86400000,()=>collectLocationGeography(lat,lng)),{headers:{'Cache-Control':'no-store'}});}
