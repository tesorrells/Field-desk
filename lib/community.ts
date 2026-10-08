export type CommunitySource={id:string,name:string,kind:'Reddit'|'Bluesky'|'Mastodon'|'Lemmy'|'News'|'Official',url:string,home:string,interval:number,format:'xml'|'bluesky',notice?:string};
const hour=3600000;
const redditNotice='Reddit plans to retire RSS on November 13, 2026. Rate limits may prevent collection before then.';
export const communitySources:CommunitySource[]=[
 {id:'wimberley-news',name:'City of Wimberley news',kind:'Official',url:'https://www.cityofwimberley.com/RSSFeed.aspx?ModID=1&CID=All-news.xml',home:'https://www.cityofwimberley.com/CivicAlerts.aspx',interval:hour/2,format:'xml',notice:'Official city news feed. Empty entries do not establish absence of notices or hazards; review the city website.'},
 {id:'mastodon-austin',name:'Mastodon · #Austin',kind:'Mastodon',url:'https://mastodon.social/tags/austin.rss',home:'https://mastodon.social/tags/austin',interval:hour/2,format:'xml',notice:'Public hashtag feed from mastodon.social, not every Mastodon server. Tags can have unrelated meanings.'},
 {id:'mastodon-atx',name:'Mastodon · #ATX',kind:'Mastodon',url:'https://mastodon.social/tags/atx.rss',home:'https://mastodon.social/tags/atx',interval:hour/2,format:'xml'},
 {id:'lemmy-austin',name:'Lemmy · Austin community',kind:'Lemmy',url:'https://lemmy.world/feeds/c/austin.xml?sort=New',home:'https://lemmy.world/c/austin',interval:hour/2,format:'xml'},
 {id:'reddit-manor',name:'r/ManorTX',kind:'Reddit',url:'https://www.reddit.com/r/ManorTX/new/.rss',home:'https://www.reddit.com/r/ManorTX/',interval:hour,format:'xml',notice:redditNotice},
 {id:'reddit-austin-manor',name:'r/Austin · Manor / ShadowGlen search',kind:'Reddit',url:'https://www.reddit.com/r/Austin/search.rss?q=Manor%20OR%20Shadowglen&restrict_sr=on&sort=new&t=month',home:'https://www.reddit.com/r/Austin/search/?q=Manor%20OR%20Shadowglen&restrict_sr=on&sort=new&t=month',interval:hour,format:'xml',notice:redditNotice},
 {id:'reddit-austin',name:'r/Austin',kind:'Reddit',url:'https://www.reddit.com/r/Austin/new/.rss',home:'https://www.reddit.com/r/Austin/',interval:hour,format:'xml',notice:redditNotice},
 {id:'reddit-pflugerville',name:'r/Pflugerville',kind:'Reddit',url:'https://www.reddit.com/r/Pflugerville/new/.rss',home:'https://www.reddit.com/r/Pflugerville/',interval:hour,format:'xml',notice:redditNotice},
 {id:'bluesky-manor',name:'Bluesky · Manor Texas',kind:'Bluesky',url:'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Manor%20Texas&sort=latest&limit=50',home:'https://bsky.app/search?q=Manor%20Texas',interval:hour/2,format:'bluesky',notice:'Public search needs no developer key. Availability varies; results are keyword matches, not verified local reports.'},
 {id:'bluesky-austin',name:'Bluesky · Austin Texas',kind:'Bluesky',url:'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=Austin%20Texas&sort=latest&limit=50',home:'https://bsky.app/search?q=Austin%20Texas',interval:hour/2,format:'bluesky'},
 {id:'kut',name:'KUT',kind:'News',url:'https://www.kut.org/kut-rss-feed-all-content.rss',home:'https://www.kut.org/kut-rss-feed-all-content',interval:hour/2,format:'xml'},
 {id:'kxan',name:'KXAN',kind:'News',url:'https://www.kxan.com/feed/',home:'https://www.kxan.com/',interval:hour/2,format:'xml'},
 {id:'monitor',name:'Austin Monitor',kind:'News',url:'https://austinmonitor.com/feed/',home:'https://www.austinmonitor.com/',interval:hour/2,format:'xml'},
 {id:'manor-news',name:'City of Manor news',kind:'Official',url:'https://www.manortx.gov/RSSFeed.aspx?ModID=1&CID=All-news.xml',home:'https://www.manortx.gov/CivicAlerts.aspx',interval:hour/2,format:'xml'},
];
export type CommunityItem={id:string,feedId:string,title:string,url:string,date?:string,updatedDate?:string,text?:string};
export type FeedSnapshot={sourceId:string,items:CommunityItem[],checkedAt:string,fetchedAt?:string,nextCheckAt:string,error?:string,cached?:boolean,cacheWarning?:string};
export function plainText(value:string){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,x:string)=>{const names:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(x[0]!=='#')return names[x.toLowerCase()]||'';const n=x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):parseInt(x.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/\s+/g,' ').trim();}
function value(xml:string,tag:string){return xml.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1]||'';}
function date(raw:string){if(!raw.trim())return undefined;const d=new Date(plainText(raw));return Number.isFinite(d.getTime())?d.toISOString():undefined;}
export function safePublicLink(raw:string){try{const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password)return undefined;const h=url.hostname.toLowerCase();if(h==='localhost'||h.endsWith('.local')||h.endsWith('.localhost')||h.includes(':')||/^\d+(\.\d+){3}$/.test(h))return undefined;return url.toString();}catch{return undefined;}}
export function parsePublicFeed(xml:string,source:CommunitySource):CommunityItem[]{
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Unsupported or oversized feed');
 const atom=/<feed(?:\s|>)/i.test(xml),rss=/<rss(?:\s|>)/i.test(xml);if((!atom&&!rss)||!new RegExp('</'+(atom?'feed':'rss')+'>','i').test(xml))throw new Error('Source did not return a complete RSS or Atom feed');
 const chunks=[...xml.matchAll(atom?/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi:/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,100);
 const items:CommunityItem[]=[];for(const [,entry] of chunks){let raw='';if(atom){const links=[...entry.matchAll(/<link\b([^>]*?)\/?\s*>/gi)];for(const [,attrs] of links){const rel=attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1];if(rel&&rel!=='alternate')continue;raw=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'';if(raw)break;}}else raw=value(entry,'link');
 const url=safePublicLink(plainText(raw)),text=source.kind==='Mastodon'?plainText(plainText(value(entry,'description'))).slice(0,300):undefined,title=(plainText(value(entry,'title'))||text||'').slice(0,300);if(!url||!title)continue;items.push({id:source.id+':'+url,feedId:source.id,title:source.kind==='Mastodon'?title.slice(0,160):title,text,url,date:date(value(entry,atom?'published':'pubDate'))||date(value(entry,'dc:date')),updatedDate:atom?date(value(entry,'updated')):undefined});}
 if(chunks.length&&!items.length)throw new Error('Feed entries could not be read safely');
 return [...new Map(items.map(p=>[p.url,p])).values()];
}
export function parseBluesky(data:any,source:CommunitySource):CommunityItem[]{
 if(!Array.isArray(data?.posts))throw new Error('Source returned invalid public search results');
 return data.posts.slice(0,50).flatMap((p:any)=>{const match=typeof p.uri==='string'?p.uri.match(/^at:\/\/(did:[a-z0-9:._%-]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9._-]+)$/i):null;if(!match||typeof p.record?.text!=='string')return [];const text=plainText(p.record.text).slice(0,300),url=`https://bsky.app/profile/${encodeURIComponent(match[1])}/post/${encodeURIComponent(match[2])}`;return [{id:source.id+':'+p.uri,feedId:source.id,title:text.slice(0,160)||'Public post',text,url,date:date(p.record.createdAt||'')}];});
}
export class FeedError extends Error {retryAfterMs:number;constructor(message:string,retryAfterMs=3600000){super(message);this.retryAfterMs=retryAfterMs;}}
async function limitedBody(r:Response){if(Number(r.headers.get('content-length')||0)>2000000)throw new FeedError('Feed exceeds the collection limit');if(!r.body)return '';const reader=r.body.getReader(),decoder=new TextDecoder();let size=0,out='';try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2000000)throw new FeedError('Feed exceeds the collection limit');out+=decoder.decode(value,{stream:true});}return out+decoder.decode();}finally{await reader.cancel();}}
export async function collectCommunity(source:CommunitySource,fetcher:typeof fetch=fetch,now=new Date()){
 if(source.kind==='Reddit'&&now.getTime()>=Date.parse('2026-11-13T00:00:00Z'))throw new FeedError('Reddit RSS retired November 13, 2026. Open the board directly.',86400000);
 const r=await fetcher(source.url,{redirect:'manual',headers:{'User-Agent':'ManorAreaStudy/1.0 (personal public feed reader)','Accept':source.format==='xml'?'application/rss+xml, application/atom+xml, application/xml, text/xml':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok){const raw=r.headers.get('retry-after'),retry=raw?/^\d+$/.test(raw)?Number(raw)*1000:Date.parse(raw)-now.getTime():0;throw new FeedError(r.status===429?'Source rate limited this reader (HTTP 429).':r.status===401||r.status===403?`Source denied anonymous collection (HTTP ${r.status}). Open the source directly.`:`Source unavailable (HTTP ${r.status}).`,Math.max(3600000,Math.min(86400000,Number.isFinite(retry)?retry:0)));}
 const text=await limitedBody(r);return source.format==='xml'?parsePublicFeed(text,source):parseBluesky(JSON.parse(text),source);
}
export async function refreshCommunity(source:CommunitySource,previous:FeedSnapshot|undefined,collect:(s:CommunitySource)=>Promise<CommunityItem[]>,now=new Date()):Promise<FeedSnapshot>{
 if(previous&&Date.parse(previous.nextCheckAt)>now.getTime())return {...previous,cached:true};
 try{const items=await collect(source);return {sourceId:source.id,items,checkedAt:now.toISOString(),fetchedAt:now.toISOString(),nextCheckAt:new Date(now.getTime()+source.interval).toISOString(),cached:false};}
 catch(e){return {sourceId:source.id,items:previous?.items||[],fetchedAt:previous?.fetchedAt,checkedAt:now.toISOString(),nextCheckAt:new Date(now.getTime()+(e instanceof FeedError?e.retryAfterMs:3600000)).toISOString(),error:e instanceof Error?e.message:'Source unavailable',cached:!!previous?.items.length};}
}
export function communityMatches(item:CommunityItem,keywords:string){const text=(item.title+' '+(item.text||'')).toLowerCase();return !keywords.trim()||keywords.split(',').slice(0,20).some(k=>k.trim()&&text.includes(k.trim().toLowerCase()));}

export function communitySourcesForCounty(fips:string){return fips==='48209'?communitySources.filter(s=>['wimberley-news','kut','kxan'].includes(s.id)):fips==='48453'?communitySources.filter(s=>s.id!=='wimberley-news'):[];}
