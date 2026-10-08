import {env} from '../../../lib/runtime-env';
import {storage} from '../../../lib/storage';
import {fetchRoadRoutes,roadRouteRequest,defaultRoutingBase} from '../../../lib/road-routing';
export async function POST(request:Request){
 try{
  const text=await request.text();if(text.length>2000)return Response.json({error:'Route request is too large.'},{status:413});
  let input;try{input=roadRouteRequest.safeParse(JSON.parse(text));}catch{return Response.json({error:'Choose two valid route endpoints.'},{status:400});}
  if(!input.success)return Response.json({error:'Choose two distinct valid route endpoints.'},{status:400});
  // Shared atomic throttle enforces the public provider's one-request/second policy.
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-1500).toISOString();
  const lock=await storage().prepare("INSERT INTO place_cache (id,content,fetched_at) VALUES ('routing:request-throttle','{}',?) ON CONFLICT(id) DO UPDATE SET fetched_at=excluded.fetched_at WHERE place_cache.fetched_at < ? RETURNING id").bind(now,cutoff).first();
  if(!lock)return Response.json({error:'Another route request just started. Wait a moment and try again.'},{status:429,headers:{'Retry-After':'2'}});
  const base=(env as unknown as Record<string,string>).OSRM_BASE_URL||defaultRoutingBase;
  const routes=await fetchRoadRoutes(input.data.from,input.data.to,base);
  return Response.json({routes},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Road routing is unavailable. Try again shortly.'},{status:502});}
}
