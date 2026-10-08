"use client";
import {useEffect,useState,useSyncExternalStore} from 'react';
import {LoaderCircle,CheckCircle2,AlertTriangle,ChevronDown,ChevronUp,X,Database} from 'lucide-react';
import {activitySnapshot,serverActivitySnapshot,subscribeActivity,clearFinishedActivity,collectionSourceNames,type CollectionActivity} from '../lib/collection-activity';
export default function CollectionActivityPanel({mapBusy=false,pending=[]}:{mapBusy?:boolean;pending?:string[]}){
 const items=useSyncExternalStore(subscribeActivity,activitySnapshot,serverActivitySnapshot);
 const [collapsed,setCollapsed]=useState(false),[now,setNow]=useState(Date.now());
 const active=items.filter(x=>!x.finishedAt);
 useEffect(()=>{if(!active.length)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active.length]);
 const queued=pending.map(k=>collectionSourceNames[k]||k).filter(name=>!active.some(x=>x.name===name));
 if(!items.length&&!mapBusy&&!pending.length)return null;
 const groups=new Map<string,CollectionActivity[]>();for(const item of items){const group=groups.get(item.name)||[];group.push(item);groups.set(item.name,group);}
 const ordered=[...groups].sort((a,b)=>Number(b[1].some(x=>!x.finishedAt))-Number(a[1].some(x=>!x.finishedAt)));
 const warnings=[...groups.values()].filter(jobs=>['error','warning'].includes(jobs[jobs.length-1].phase));
 const title=active.length||pending.length?'Collecting area information':mapBusy?'Drawing map layers':warnings.length?'Collection needs review':'Collection finished';
 return <section className={`collection-activity ${collapsed?'is-collapsed':''}`} aria-label="Data collection activity">
 <div className="collection-activity-heading"><span aria-hidden="true">{active.length||pending.length||mapBusy?<LoaderCircle className="activity-spin" size={19}/>:warnings.length?<AlertTriangle size={19}/>:<CheckCircle2 size={19}/>}</span><div><strong role="status" aria-live="polite">{title}</strong><small>{active.length?`${new Set(active.map(x=>x.name)).size} sources active · ${active.length} requests`:mapBusy?'Applying loaded records':'Recent source checks'}</small></div><button aria-label={collapsed?'Expand collection activity':'Minimize collection activity'} aria-expanded={!collapsed} onClick={()=>setCollapsed(x=>!x)}>{collapsed?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>{!active.length&&!pending.length&&!mapBusy&&<button aria-label="Dismiss finished collection activity" onClick={clearFinishedActivity}><X size={17}/></button>}</div>
 {!collapsed&&<><p className="collection-activity-note">{mapBusy?'Drawing loaded records in small batches.':active.length||pending.length?'Large areas and parcel sections can take longer. You can switch tabs while sources load.':'Responses may include cached or partial data. Review dates and coverage in Sources & reports.'}</p><div className="collection-activity-list">{ordered.filter(([name])=>!queued.includes(name)).map(([name,jobs])=>{const running=jobs.filter(x=>!x.finishedAt),last=jobs[jobs.length-1],issue=last.phase==='error'||last.phase==='warning'?last:undefined,row=running[0]||issue||last;return <div className={`collection-activity-row activity-${row.phase}`} key={name}><span aria-hidden="true">{running.length?<LoaderCircle size={16} className="activity-spin"/>:issue?<AlertTriangle size={16}/>:<Database size={16}/>}</span><div><strong>{name}</strong><small>{running.length?`${row.detail}${running.length>1?` · ${running.length} requests`:''} · ${Math.max(0,Math.floor((now-row.startedAt)/1000))}s`:row.detail}</small></div></div>;})}{queued.map(name=><div className="collection-activity-row" key={"queued-"+name}><Database size={16}/><div><strong>{name}</strong><small>Queued for refresh</small></div></div>)}</div></>}
 </section>;
}
