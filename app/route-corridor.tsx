"use client";
import {collectionFetch} from '../lib/collection-activity';
import {useEffect,useRef,useState} from 'react';
import {collectRouteCorridor,routeSignature,type CorridorReport,type CorridorRecord} from '../lib/route-corridor';
import type {StudyRoute} from '../lib/routes';
import {reportDate} from '../lib/report-dates';
export default function RouteCorridor({route,loaded,finish}:{route:StudyRoute;loaded:boolean;finish:(report:CorridorReport,rows:CorridorRecord[])=>void}){
 const [width,setWidth]=useState<250|500|1000>(route.corridor?.width||500),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function collect(){
  setError('');setBusy(true);const abort=new AbortController();controller.current=abort;
  try{const result=await collectRouteCorridor(route.points,width,abort.signal,(done,total)=>setProgress(`${done} / ${total} source sections checked`),collectionFetch);if(!abort.signal.aborted){finish(result.report,result.rows);setProgress('');}}
  catch(e){if(!abort.signal.aborted)setError((e as Error).message);}
  finally{if(controller.current===abort)setBusy(false);}
 }
 const report=route.corridor,current=report?.signature===routeSignature(route.points);
 return <section className="corridor-card"><h3>Full route corridor</h3><p className="help">Search the entire traced trip independently of your AOR/AOI. Overlapping searches reuse cached records.</p><label>Search distance on each side<select disabled={busy} value={width} onChange={e=>setWidth(Number(e.target.value) as 250|500|1000)}><option value={250}>250 metres</option><option value={500}>500 metres</option><option value={1000}>1 kilometre</option></select></label><button className="primary" disabled={busy} onClick={collect}>{busy?'Collecting corridor…':report?'Refresh corridor data':'Collect corridor data'}</button>{busy&&<button onClick={()=>{controller.current?.abort();setBusy(false);setProgress('Collection cancelled; previous report retained.');}}>Cancel collection</button>}<p role="status" className="help">{progress}</p>{error&&<p role="alert" className="notice">{error}</p>}{report&&<><p className="help">{report.count} records · {report.width} m each side · checked {reportDate(report.collectedAt,true)}</p>{!current&&<p className="notice">The route geometry changed. Refresh to collect its new corridor.</p>}{current&&!loaded&&<p className="notice">Saved collection summary. Collect again to retrieve cached findings for this session.</p>}{report.sources.map(s=><article className="corridor-source" key={s.kind}><strong>{s.name}</strong><p>{s.count} nearby records · {s.complete} / {s.total} sections fresh and complete{s.failed?` · ${s.failed} failed`:''}{s.skipped?` · ${s.skipped} skipped after source failures`:''}{s.unsupported?` · ${s.unsupported} outside source coverage`:''}{s.stale?` · ${s.stale} stale`:''}</p>{s.warnings.length>0&&<details><summary>Source notes & coverage limits</summary>{s.warnings.map((w,i)=><p className="help" key={i}>{w}</p>)}</details>}</article>)}</>}<p className="help">Crossings and incident points are nearby records, not confirmed road dependencies. Flood zones describe mapped exposure. Source completion does not confirm road access or facility availability.</p></section>;
}
