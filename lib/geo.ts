export type Point=[number,number];
export function inside(p:Point,polygon:Point[]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[y,x]=polygon[i],[yj,xj]=polygon[j];if(((y>p[0])!==(yj>p[0]))&&(p[1]<(xj-x)*(p[0]-y)/(yj-y)+x))yes=!yes;}return yes;}
export function areaSqMiles(p:Point[]){if(p.length<3)return 0;const lat=p.reduce((s,x)=>s+x[0],0)/p.length;let a=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;a+=p[i][1]*p[j][0]-p[j][1]*p[i][0];}return Math.abs(a)/2*69.093**2*Math.cos(lat*Math.PI/180);}
function cross(a:Point,b:Point,c:Point){return(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);}
function intersect(a:Point,b:Point,c:Point,d:Point){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function simple(p:Point[]){if(p.length<3||areaSqMiles(p)<0.00001)return false;for(let i=0;i<p.length;i++){if(p.some((q,j)=>i!==j&&q[0]===p[i][0]&&q[1]===p[i][1]))return false;for(let j=i+1;j<p.length;j++){if(j===i+1||(i===0&&j===p.length-1))continue;if(intersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;}}return true;}
export function containsPolygon(outer:Point[],inner:Point[]){if(!inner.every(p=>inside(p,outer)))return false;for(let i=0;i<inner.length;i++)for(let j=0;j<outer.length;j++)if(intersect(inner[i],inner[(i+1)%inner.length],outer[j],outer[(j+1)%outer.length]))return false;return true;}

export type ParcelGeometry={type:'Polygon'|'MultiPolygon';coordinates:any[]};
function polygons(g:ParcelGeometry):number[][][][]{return g.type==='Polygon'?[g.coordinates]:g.coordinates;}
function onSegment(p:Point,a:Point,b:Point){return Math.abs((b[1]-a[1])*(p[0]-a[0])-(b[0]-a[0])*(p[1]-a[1]))<1e-12&&p[0]>=Math.min(a[0],b[0])-1e-10&&p[0]<=Math.max(a[0],b[0])+1e-10&&p[1]>=Math.min(a[1],b[1])-1e-10&&p[1]<=Math.max(a[1],b[1])+1e-10;}
function hit(a:Point,b:Point,c:Point,d:Point){const cross=(p:Point,q:Point,r:Point)=>(q[1]-p[1])*(r[0]-p[0])-(q[0]-p[0])*(r[1]-p[1]);return onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b)||cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function lineIntersectsGeometry(points:Point[],g:ParcelGeometry){
 if(points.some(p=>geometryContains(g,p)))return true;
 const rings=polygons(g).flatMap(r=>r.map(r=>r.map(([x,y])=>[y,x] as Point)));
 return points.slice(1).some((b,i)=>rings.some(r=>r.some((c,j)=>hit(points[i],b,c,r[(j+1)%r.length]))));
}
export function parcelIntersects(g:ParcelGeometry,boundary:Point[]){
 return polygons(g).some(rings=>{const p=rings[0].map(([x,y])=>[y,x] as Point);const holes=rings.slice(1).map(r=>r.map(([x,y])=>[y,x] as Point));
 if(p.some(v=>inside(v,boundary))||boundary.some(v=>inside(v,p)&&!holes.some(h=>inside(v,h))))return true;
 return [p,...holes].some(r=>r.some((a,i)=>boundary.some((c,j)=>hit(a,r[(i+1)%r.length],c,boundary[(j+1)%boundary.length]))));});
}
export function parcelInBounds(g:ParcelGeometry,b:[number,number,number,number]){return parcelIntersects(g,[[b[0],b[1]],[b[0],b[3]],[b[2],b[3]],[b[2],b[1]]]);}
export function geometryContains(g:ParcelGeometry,p:Point){return polygons(g).some(rings=>{const r=rings.map(r=>r.map(([x,y])=>[y,x] as Point));return (inside(p,r[0])||r[0].some((a,i)=>onSegment(p,a,r[0][(i+1)%r[0].length])))&&!r.slice(1).some(h=>inside(p,h));});}
export function geometryIntersects(a:ParcelGeometry,b:ParcelGeometry){
 const ar=polygons(a).flatMap(r=>r.map(r=>r.map(([x,y])=>[y,x] as Point))),br=polygons(b).flatMap(r=>r.map(r=>r.map(([x,y])=>[y,x] as Point)));
 if(polygons(a).some(r=>r[0].some(([x,y])=>geometryContains(b,[y,x])))||polygons(b).some(r=>r[0].some(([x,y])=>geometryContains(a,[y,x]))))return true;
 return ar.some(r=>r.some((p,i)=>br.some(s=>s.some((q,j)=>hit(p,r[(i+1)%r.length],q,s[(j+1)%s.length])))));
}
