export function localRequestAllowed(request:Request){
 const u=new URL(request.url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return false;
 const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return false;
 return request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
