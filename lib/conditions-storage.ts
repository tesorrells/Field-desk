import {storage} from './storage';
import {refreshCondition,type ConditionSnapshot} from './conditions';
const running=new Map<string,Promise<ConditionSnapshot>>();
export async function cachedCondition(key:string,ttl:number,collect:()=>Promise<any>){
 if(running.has(key))return running.get(key)!;
 const task=(async()=>{let prior:ConditionSnapshot|undefined,cacheWarning:string|undefined;try{const r=await storage().prepare('SELECT content FROM place_cache WHERE id=?').bind('conditions:'+key).first<{content:string}>();if(r)prior=JSON.parse(r.content);}catch{cacheWarning='Source cache unavailable';}
 const result=await refreshCondition(prior,collect,ttl);if(!result.cached||result.checkedAt!==prior?.checkedAt){try{await storage().prepare('INSERT INTO place_cache (id,content,fetched_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,fetched_at=excluded.fetched_at').bind('conditions:'+key,JSON.stringify(result),result.checkedAt).run();}catch{cacheWarning='Could not cache this source';}}return {...result,cacheWarning};})();running.set(key,task);try{return await task;}finally{running.delete(key);}
}
