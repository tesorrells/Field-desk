import type {SharedRecord} from './sharing-schema';
import {sharedLifecycle} from './sharing';
import {needsSharedAttention} from './sharing-changes';
const opaqueKeys=new Set(['id','recordId','revisionId','replacesRevisionId']);
const searchText=(record:SharedRecord)=>JSON.stringify({author:record.member.name,revisions:record.revisions,reviews:record.reviews},(key,value)=>opaqueKeys.has(key)?undefined:value).toLocaleLowerCase();
export function sharedSearchIndex(records:SharedRecord[]){return new Map(records.map(record=>[record.id,searchText(record)]));}
export function matchingSharedRecords(records:SharedRecord[],selected:Record<string,string>,{search='',kind='All',author='All',state='All'}={},index?:Map<string,string>){
 const terms=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(record=>{
  const revision=record.revisions.find(v=>v.id===selected[record.id])||record.revisions[0];
  if(kind!=='All'&&revision.payload.kind!==kind||author!=='All'&&record.member.id!==author)return false;
  if(state==='Needs attention'&&!needsSharedAttention(record,selected[record.id])||state==='Multiple revisions'&&record.revisions.length<2||state==='Withdrawn'&&!sharedLifecycle(record).withdrawn)return false;
  const text=index?.get(record.id)||searchText(record);
  return terms.every(term=>text.includes(term));
 });
}
