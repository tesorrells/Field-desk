import {cachedCondition} from '../../../lib/conditions-storage';
import {collectLocationGeography} from '../../../lib/location-geography';
import {validPoint} from '../../../lib/location-core';
import {communitySources,communitySourcesForCounty,collectCommunity,refreshCommunity,type FeedSnapshot} from '../../../lib/community';
import {readCommunity,writeCommunity} from '../../../lib/community-storage';
const inflight=new Map<string,Promise<FeedSnapshot>>();
async function load(id:string,cacheOnly:boolean){const source=communitySources.find(s=>s.id===id)!;let previous:FeedSnapshot|undefined,cacheWarning:string|undefined;try{previous=await readCommunity(id);}catch{cacheWarning='Shared feed cache is unavailable.';}
 if(cacheOnly)return previous?{...previous,cached:true,cacheWarning}:undefined;
 if(previous&&Date.parse(previous.nextCheckAt)>Date.now())return {...previous,cached:true,cacheWarning};
 if(inflight.has(id))return inflight.get(id);
 const task=(async()=>{const feed=await refreshCommunity(source,previous,s=>collectCommunity(s));try{await writeCommunity(feed);}catch{feed.cacheWarning='Feed loaded, but could not be cached for other areas.';}return {...feed,cacheWarning:feed.cacheWarning||cacheWarning};})();inflight.set(id,task);try{return await task;}finally{inflight.delete(id);}
}
export async function GET(request:Request){const q=new URL(request.url).searchParams,id=q.get('source');if(id&&!communitySources.some(s=>s.id===id))return Response.json({error:'Unknown public feed'},{status:400});let registry=communitySources;if(q.has('lat')||q.has('lng')){const lat=Number(q.get('lat')),lng=Number(q.get('lng'));if(!q.get('lat')?.trim()||!q.get('lng')?.trim()||!validPoint(lat,lng))return Response.json({error:'Choose a valid location point.'},{status:400});const context=await cachedCondition('location-context:'+lat+','+lng,86400000,()=>collectLocationGeography(lat,lng));if(!context.data)return Response.json({error:'County lookup unavailable; local feed selection needs verification.'},{status:502});registry=communitySourcesForCounty(context.data.countyFips);}const sources=id?registry.filter(s=>s.id===id):registry;const feeds:(FeedSnapshot|undefined)[]=new Array(sources.length);let index=0;await Promise.all(Array.from({length:3},async()=>{while(index<sources.length){const i=index++;feeds[i]=await load(sources[i].id,q.get('cacheOnly')==='1');}}));return Response.json({sourceIds:sources.map(s=>s.id),feeds:feeds.filter(Boolean)},{headers:{'Cache-Control':'no-store'}});}
