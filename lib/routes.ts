import type {RoutingMetadata} from './road-routing';
import type {CorridorReport} from './route-corridor';
import type {CrossingStatus} from './crossing-status';
import {lineIntersectsGeometry,type Point,type ParcelGeometry} from './geo';
export type RouteMark={id:string,point:Point,name:string,kind:'Exit'|'Bridge'|'Bottleneck'};
export type StudyRoute={id:string,name:string,destination:string,role:'Primary'|'Alternate'|'Contingency'|'Emergency',corridor?:CorridorReport,routing?:RoutingMetadata,fromLocationId?:string,toLocationId?:string,points:Point[],notes:string,marks:RouteMark[]};
export type TerrainRecord={id:string,name:string,lat:number,lng:number,source:string,closure?:CrossingStatus,retrievedAt?:string,stale?:boolean,geometry?:ParcelGeometry,flood?:{model:string},crossing?:unknown};
// Local equirectangular distances in meters, suitable for the Austin study area.
export function distanceToRoute(point:Point,line:Point[]){
 const scale=Math.cos(point[0]*Math.PI/180),xy=(p:Point)=>[(p[1]-point[1])*111320*scale,(p[0]-point[0])*111320];
 let best=Infinity;
 for(let i=1;i<line.length;i++){const a=xy(line[i-1]),b=xy(line[i]),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/den)):0;best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));}return best;
}
export function routeMiles(points:Point[]){return points.slice(1).reduce((sum,p,i)=>{const a=points[i],lat=(a[0]+p[0])/2;return sum+Math.hypot((p[0]-a[0])*111320,(p[1]-a[1])*111320*Math.cos(lat*Math.PI/180))/1609.344;},0);}
export function routeFindings(route:StudyRoute,records:TerrainRecord[]){
 const bounds=[Math.min(...route.points.map(p=>p[0])),Math.min(...route.points.map(p=>p[1])),Math.max(...route.points.map(p=>p[0])),Math.max(...route.points.map(p=>p[1]))];
 const floods=records.filter(p=>p.flood&&p.geometry).filter(p=>{const rings=p.geometry!.type==='Polygon'?[p.geometry!.coordinates]:p.geometry!.coordinates;return rings.some(r=>{const b=(r[0] as number[][]).reduce((b,[x,y])=>[Math.min(b[0],y),Math.min(b[1],x),Math.max(b[2],y),Math.max(b[3],x)],[Infinity,Infinity,-Infinity,-Infinity]);return b[2]>=bounds[0]&&b[0]<=bounds[2]&&b[3]>=bounds[1]&&b[1]<=bounds[3];});});
 const segments=route.points.slice(1).map((p,i)=>({points:[route.points[i],p] as Point[],floods:floods.filter(f=>lineIntersectsGeometry([route.points[i],p],f.geometry!))}));
 return {closures:records.filter(p=>p.closure&&distanceToRoute([p.lat,p.lng],route.points)<=100),segments,floods:[...new Map(segments.flatMap(s=>s.floods).map(p=>[p.id,p])).values()],crossings:records.filter(p=>p.crossing&&distanceToRoute([p.lat,p.lng],route.points)<=100)};
}
export function sharedRouteMarks(route:StudyRoute,others:StudyRoute[]){return route.marks.filter(m=>others.some(r=>r.id!==route.id&&r.marks.some(n=>n.kind===m.kind&&n.name.trim().toLowerCase()===m.name.trim().toLowerCase())));}
export function routeFeature(route:StudyRoute){return {type:'Feature',properties:{kind:'route',id:route.id,name:route.name,destination:route.destination,role:route.role,fromLocationId:route.fromLocationId,toLocationId:route.toLocationId,notes:route.notes,marks:route.marks,corridor:route.corridor,routing:route.routing},geometry:{type:'LineString',coordinates:route.points.map(p=>[p[1],p[0]])}};}
