export const PLACE_PROVIDERS=[
 {name:"Overpass API",url:"https://overpass-api.de/api/interpreter"},
 {name:"VK Maps Overpass",url:"https://maps.mail.ru/osm/tools/overpass/api/interpreter"},
 {name:"Private.coffee Overpass",url:"https://overpass.private.coffee/api/interpreter"},
];
export function placeQuery(bbox:number[]){const extent=bbox.join(",");return `[out:json][timeout:18];(nwr[shop~"^(supermarket|convenience)$"](${extent});nwr[amenity~"^(hospital|clinic|pharmacy|fuel|fire_station|police|school|community_centre|townhall|shelter|post_office|telephone)$"](${extent});nwr[leisure~"^(park|stadium|sports_centre)$"](${extent});nwr[power~"^(plant|substation)$"](${extent});nwr[man_made~"^(water_works|wastewater_plant|communications_tower)$"](${extent}););out center 1500;`;}
export async function fetchPlaces(bbox:number[],fetcher:typeof fetch=fetch){
 const failures:string[]=[];
 for(const provider of PLACE_PROVIDERS){
  try{
   const url=provider.url+"?"+new URLSearchParams({data:placeQuery(bbox)});
   const response=await fetcher(url,{headers:{"User-Agent":"ManorAreaIntelligence/1.1","Accept":"application/json"},signal:AbortSignal.timeout(22000)});
   if(!response.ok){failures.push(`${provider.name}: HTTP ${response.status}${response.status===429?" (rate limited)":""}`);continue;}
   const data:any=await response.json();
   if(data.remark){failures.push(`${provider.name}: incomplete query response`);continue;}
   if(!Array.isArray(data.elements)){failures.push(`${provider.name}: invalid response`);continue;}
   const rows=data.elements.map((x:any)=>({id:`osm-${x.type}-${x.id}`,name:x.tags?.name||x.tags?.amenity||x.tags?.shop||x.tags?.leisure||x.tags?.man_made||x.tags?.power||"Unnamed place",lat:x.lat??x.center?.lat,lng:x.lon??x.center?.lon,category:x.tags?.amenity==="police"?"Police & sheriff":x.tags?.amenity==="fire_station"?"Fire stations":x.tags?.power||x.tags?.man_made==="communications_tower"?"Power & communications":x.tags?.man_made==="water_works"?"Water providers":x.tags?.man_made==="wastewater_plant"?"Wastewater providers":x.tags?.shop?"Food & supplies":["hospital","clinic","pharmacy"].includes(x.tags?.amenity)?"Medical":["fire_station","police","shelter"].includes(x.tags?.amenity)?"Public services":x.tags?.amenity==="fuel"?"Fuel":"Gathering places",source:"OpenStreetMap",detail:[x.tags?.["addr:housenumber"],x.tags?.["addr:street"],x.tags?.phone,x.tags?.["contact:phone"],"Community-maintained facility record. Current availability and operating status are not verified."].filter(Boolean).join(" · "),url:`https://www.openstreetmap.org/${x.type}/${x.id}`})).filter((x:any)=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
   return {rows,limit:1500,fetchedAt:new Date().toISOString(),sourceUpdatedAt:data.osm3s?.timestamp_osm_base,provider:provider.name,failures};
  }catch(error){const name=error instanceof Error?error.name:"Error";failures.push(`${provider.name}: ${name==="TimeoutError"||name==="AbortError"?"request timed out":name==="SyntaxError"?"invalid response":"connection failed"}`);}
 }
 throw new Error(`No places were loaded. ${failures.join("; ")}. Retry shortly. This is a source failure, not evidence that your AOI has no places.`);
}
