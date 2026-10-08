import {z} from 'zod';
import {pointSchema} from './location-core';
import type {Point} from './geo';

const point=pointSchema;
// Reject duplicate corners, negligible area, and any nonadjacent edges that touch or cross.
export function validNaiPolygon(p:Point[]){
 if(p.length<3||p.length>200||new Set(p.map(v=>v.join(','))).size!==p.length)return false;
 const origin=p[0],area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+(a[1]-origin[1])*(b[0]-origin[0])-(b[1]-origin[1])*(a[0]-origin[0]);},0);
 if(Math.abs(area)<1e-10)return false;
 const cross=(a:Point,b:Point,c:Point)=>(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
 const on=(p:Point,a:Point,b:Point)=>Math.abs(cross(a,b,p))<1e-12&&p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12&&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;
 for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
  if(j===i+1||(i===0&&j===p.length-1))continue;
  const a=p[i],b=p[(i+1)%p.length],c=p[j],d=p[(j+1)%p.length];
  if(on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b)||cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return false;
 }
 return true;
}
export const naiSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(160),kind:z.enum(['Point','Polygon']),points:z.array(point).min(1).max(200),notes:z.string().max(2000),createdAt:z.string().datetime()}).superRefine((n,ctx)=>{
 if(n.kind==='Point'?n.points.length!==1:!validNaiPolygon(n.points))ctx.addIssue({code:z.ZodIssueCode.custom,path:['points'],message:'Choose one point, or a polygon with distinct corners and no crossing edges'});
});
export const naisSchema=z.array(naiSchema).max(100).refine(n=>new Set(n.map(x=>x.id)).size===n.length,'Duplicate named area IDs').default([]);
export type NamedArea=z.infer<typeof naiSchema>;
export function naiFeature(n:NamedArea,questionIds:string[]){return {type:'Feature',properties:{kind:'nai',id:n.id,name:n.name,shape:n.kind,notes:n.notes,createdAt:n.createdAt,questionIds},geometry:n.kind==='Point'?{type:'Point',coordinates:[n.points[0][1],n.points[0][0]]}:{type:'Polygon',coordinates:[[...n.points,n.points[0]].map(([lat,lng])=>[lng,lat])]}};}
export function removeNaiLinks<T extends {naiIds:string[],requirements?:{naiIds:string[]}[]}>(questions:T[],id:string):T[]{return questions.map(q=>({...q,naiIds:q.naiIds.filter(x=>x!==id),...(q.requirements?{requirements:q.requirements.map(r=>({...r,naiIds:r.naiIds.filter(x=>x!==id)}))}:{})}));}
