export async function GET(request:Request) {
 const q=new URL(request.url).searchParams.get("q")?.trim(); if(!q || q.length>240) return Response.json({error:"Enter a street address"},{status:400});
 try { const url=new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");url.search=new URLSearchParams({address:q,benchmark:"Public_AR_Current",format:"json"}).toString(); const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const d:any=await r.json();return Response.json({matches:d.result.addressMatches.filter((m:any)=>Number.isFinite(m.coordinates?.y)&&Number.isFinite(m.coordinates?.x))}); }
 catch { return Response.json({error:"Address lookup is unavailable. Use Place home and click the map."},{status:502}); }
}
