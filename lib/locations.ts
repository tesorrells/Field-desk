import {studySchema,type studyLocationSchema,type locationContextSchema} from './study-schema';
import type {z} from 'zod';
import type {StudyRoute} from './routes';
import {routeFeature} from './routes';
import {naiFeature} from './nais';
export type StudyLocation=z.infer<typeof studyLocationSchema>;
export type LocationContext=z.infer<typeof locationContextSchema>;
export type Portfolio=z.infer<typeof studySchema>;
export const contextFields=['radioPlan','scenarios','home','areas','notes','sections','nais','collection','servicePlans','utilityProviders'] as const;
export function emptyContext():LocationContext{return {radioPlan:[],scenarios:[],home:null,areas:{aor:[],aoi:[]},notes:[],sections:{},nais:[],collection:{purpose:'',questions:[]},servicePlans:[],utilityProviders:{electricity:'unknown',water:'unknown'}};}
export function newLocation(name='New location',kind:StudyLocation['kind']='Other'):StudyLocation{return {...emptyContext(),id:crypto.randomUUID(),name,kind,notional:false};}
export function restorePortfolio(raw:unknown):Portfolio{return studySchema.parse(raw);}
export function activeStudy(p:Portfolio):LocationContext&{schemaVersion:18,routes:StudyRoute[]}{const location=p.locations.find(l=>l.id===p.activeLocationId);return {...(location||p),schemaVersion:18,routes:p.routes};}
export function updateActive(p:Portfolio,fn:(s:ReturnType<typeof activeStudy>)=>ReturnType<typeof activeStudy>):Portfolio{const next=fn(activeStudy(p)),context=Object.fromEntries(contextFields.map(k=>[k,next[k]])) as LocationContext;return p.activeLocationId==='home'?{...p,...context,routes:next.routes}:{...p,routes:next.routes,locations:p.locations.map(l=>l.id===p.activeLocationId?{...l,...context}:l)};}
export function locationEndpoints(p:Portfolio){return [{id:'home',name:'Home',kind:'Home',home:p.home,notional:false},...p.locations.map(l=>({id:l.id,name:l.name,kind:l.kind,home:l.home,notional:l.notional}))];}
export function portfolioExport(p:Portfolio){
 const contexts=[{id:'home',name:'Home',kind:'Home',...p},...p.locations],features:unknown[]=[];
 for(const c of contexts){
  if(c.home)features.push({type:'Feature',properties:{kind:'study-location',locationId:c.id,name:c.name,locationKind:c.kind,address:c.home.address},geometry:{type:'Point',coordinates:[c.home.point[1],c.home.point[0]]}});
  for(const k of ['aor','aoi'] as const){const ring=c.areas[k];if(ring.length>=3)features.push({type:'Feature',properties:{kind:k,locationId:c.id},geometry:{type:'Polygon',coordinates:[[...ring,ring[0]].map(([lat,lng])=>[lng,lat])]}});}
  for(const n of c.nais){const f=naiFeature(n,c.collection.questions.filter(q=>q.naiIds.includes(n.id)).map(q=>q.id));features.push({...f,properties:{...f.properties,locationId:c.id}});}
  for(const n of c.notes)features.push({type:'Feature',properties:{...n,locationId:c.id},geometry:{type:'Point',coordinates:[n.lng,n.lat]}});
 }
 for(const r of p.routes){features.push(routeFeature(r));for(const m of r.marks)features.push({type:'Feature',properties:{kind:'route-feature',routeId:r.id,name:m.name,featureType:m.kind},geometry:{type:'Point',coordinates:[m.point[1],m.point[0]]}});}
 return {type:'FeatureCollection',features,portfolio:p,schemaVersion:18};
}

export function mergeConfiguredLocations(p:Portfolio,configured:{name:string;kind:StudyLocation['kind'];address:string;point?:[number,number];sourceNote?:string}[]):Portfolio{const locations=[...p.locations];for(const [index,c] of configured.entries()){const normalize=(address:string)=>address.toLowerCase().replace(/[^a-z0-9]/g,'');const existing=locations.findIndex(l=>l.id==='configured-'+index||normalize(l.home?.address||'')===normalize(c.address));if(existing>=0){const l=locations[existing];locations[existing]={...l,notional:false,name:l.notional?c.name:l.name,home:l.home?{...l.home,sourceNote:l.home.sourceNote||c.sourceNote}:l.home};continue;}if(locations.length>=20)break;if(!c.point)continue;locations.push({...emptyContext(),id:'configured-'+index,name:c.name,kind:c.kind,notional:false,home:c.point?{point:c.point,address:c.address,sourceNote:c.sourceNote}:null});}return {...p,locations};}
