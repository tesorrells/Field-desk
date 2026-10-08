import {z} from 'zod';
import type {Point} from './geo';
export const pointSchema=z.tuple([z.number().min(-90).max(90),z.number().min(-180).max(180)]);
export function validPoint(lat:number,lng:number){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;}
export function validArea(b:number[]){return b.length===4&&validPoint(b[0],b[1])&&validPoint(b[2],b[3])&&b[0]<b[2]&&b[1]<b[3]&&(b[2]-b[0])*(b[3]-b[1])<=.7;}
export type LocationEndpoint={id:string,name:string,kind:string,home:{point:Point,address:string}|null,notional?:boolean};
export function directionsUrl(from:Point,to:Point){const u=new URL('https://www.google.com/maps/dir/');u.search=new URLSearchParams({api:'1',origin:from.join(','),destination:to.join(','),travelmode:'driving'}).toString();return u.toString();}
export function starterBoundary(point:Point,miles:number){const dy=miles/69.093,dx=dy/Math.max(.1,Math.cos(point[0]*Math.PI/180));return [[point[0]-dy,point[1]-dx],[point[0]-dy,point[1]+dx],[point[0]+dy,point[1]+dx],[point[0]+dy,point[1]-dx]] as Point[];}
