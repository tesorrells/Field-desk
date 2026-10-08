import {z} from 'zod';
import {pointSchema} from './location-core';
import type {Point} from './geo';
export const defaultRoutingBase='https://routing.openstreetmap.de/routed-car';
export const roadRouteRequest=z.object({from:pointSchema,to:pointSchema}).refine(r=>r.from[0]!==r.to[0]||r.from[1]!==r.to[1],'Choose different endpoints');
export const routingMetadataSchema=z.object({provider:z.string().max(100),profile:z.literal('Driving'),sourceUrl:z.string().url().max(1000).refine(u=>/^https?:\/\//.test(u)),generatedAt:z.string().datetime(),distanceMetres:z.number().finite().nonnegative(),durationSeconds:z.number().finite().nonnegative(),origin:pointSchema,destination:pointSchema,snapOriginMetres:z.number().finite().nonnegative(),snapDestinationMetres:z.number().finite().nonnegative()});
export type RoutingMetadata=z.infer<typeof routingMetadataSchema>;
export type RoadRoute={points:Point[];routing:RoutingMetadata};
const osrmShape=z.object({code:z.literal('Ok'),waypoints:z.array(z.object({distance:z.number().finite().nonnegative()})).length(2),routes:z.array(z.object({distance:z.number().finite().positive(),duration:z.number().finite().nonnegative(),geometry:z.object({type:z.literal('LineString'),coordinates:z.array(z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)])).min(2).max(6000)})})).min(1).max(10)});
export async function fetchRoadRoutes(from:Point,to:Point,base=defaultRoutingBase,fetcher:typeof fetch=fetch):Promise<RoadRoute[]>{
 roadRouteRequest.parse({from,to});const endpoint=new URL(base);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('Routing provider must be an HTTPS OSRM base URL.');
 const url=new URL(endpoint.toString().replace(/\/$/,'')+`/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}`);
 url.search=new URLSearchParams({overview:'full',geometries:'geojson',alternatives:'true',steps:'false',radiuses:'1000;1000'}).toString();
 const response=await fetcher(url,{headers:{'User-Agent':'AreaIntelligence/1.2','Accept':'application/json'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(`Road routing returned HTTP ${response.status}. Try again shortly.`);
 const data=await response.json() as {code?:string};
 if(data.code==='NoRoute'||data.code==='NoSegment')throw Error('No connected driving route was found within 1 km of both pins. Verify your endpoints.');
 const parsed=osrmShape.safeParse(data);if(!parsed.success)throw Error('The routing provider returned an invalid or oversized route. Choose a shorter trip or trace it manually.');
 if(parsed.data.waypoints.some(w=>w.distance>1000))throw Error('The nearest routable road is over 1 km from a pin. Verify your endpoints.');
 return parsed.data.routes.slice(0,3).map(r=>({points:r.geometry.coordinates.map(([lng,lat])=>[lat,lng] as Point),routing:{provider:endpoint.host==='routing.openstreetmap.de'?'FOSSGIS / OSRM':'Configured OSRM provider',profile:'Driving',sourceUrl:endpoint.host==='routing.openstreetmap.de'?'https://routing.openstreetmap.de/about.html':endpoint.origin,generatedAt:new Date().toISOString(),distanceMetres:r.distance,durationSeconds:r.duration,origin:from,destination:to,snapOriginMetres:parsed.data.waypoints[0].distance,snapDestinationMetres:parsed.data.waypoints[1].distance}}));
}
export function parseDirectionsLink(value:string){
 const u=new URL(value.trim());if(u.protocol!=='https:'||!['google.com','www.google.com','maps.google.com'].includes(u.hostname))throw Error('Use a full Google Maps directions link. Open shortened links in Google Maps first.');
 let from=u.searchParams.get('origin'),to=u.searchParams.get('destination');
 if(!from||!to){const path=u.pathname.split('/').filter(Boolean),index=path.indexOf('dir');if(index>=0){if(path[index+3]&&!path[index+3].startsWith('@')&&!path[index+3].startsWith('data='))throw Error('This link contains additional stops. Enter the trip’s origin and final destination directly.');from=decodeURIComponent(path[index+1]||'').replace(/\+/g,' ');to=decodeURIComponent(path[index+2]||'').replace(/\+/g,' ');}}
 if(!from||!to||from.startsWith('@')||to.startsWith('@')||from.length>240||to.length>240)throw Error('This link does not contain both endpoint addresses. Enter the addresses or choose saved locations.');
 return {from,to};
}
export function coordinateAddress(value:string):Point|null{const parts=value.trim().split(',').map(Number);const match=pointSchema.safeParse(parts);return /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(value)&&match.success?match.data:null;}
