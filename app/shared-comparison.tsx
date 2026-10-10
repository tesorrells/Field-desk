"use client";
import {useState} from 'react';
import {latestSharedRevision} from '../lib/sharing';
import {payloadChanges} from '../lib/sharing-changes';
import type {SharedRecord} from '../lib/sharing-schema';

const labels:Record<string,string>={kind:'Type',name:'Name',detail:'Description',point:'Position',points:'Geometry',source:'Source',url:'Source link',observedAt:'Observation date',confidence:'Confidence'};
function display(value:unknown){return value===undefined?'Not supplied':typeof value==='string'?value||'(empty)':JSON.stringify(value);}
export default function SharedComparison({record,baseline}:{record:SharedRecord;baseline?:SharedRecord['revisions'][number]}){
 const [choice,setChoice]=useState(latestSharedRevision(record).id);
 const candidate=record.revisions.find(v=>v.id===choice)||latestSharedRevision(record);
 if(!baseline)return <p className="help">New contribution: no local revision to compare.</p>;
 const differences=payloadChanges(baseline.payload,candidate.payload);
 return <details className="shared-comparison"><summary>Compare with your displayed revision</summary><p className="help">Your displayed version was recorded {new Date(baseline.createdAt).toLocaleString()}. Selecting a comparison does not change the map.</p><label>Revision to compare<select value={candidate.id} onChange={e=>setChoice(e.target.value)}>{record.revisions.map(v=><option key={v.id} value={v.id}>{new Date(v.createdAt).toLocaleString()} · {v.id.slice(0,8)}{v.id===baseline.id?' · displayed':''}</option>)}</select></label><p className="notice" hidden={!candidate.notice}>{candidate.notice?.kind}: {candidate.notice?.reason}</p><p className="help">{differences.length} changed fields. Dates are contributor claims; revision order does not establish truth.</p>{!!differences.length&&<div className="shared-diff-scroll"><table className="shared-diff"><thead><tr><th>Field</th><th>Your displayed revision</th><th>Compared revision</th></tr></thead><tbody>{differences.map(d=><tr key={d.key}><th scope="row">{labels[d.key]||d.key}</th><td>{display(d.before)}</td><td>{display(d.after)}</td></tr>)}</tbody></table></div>}{!differences.length&&<p>Content matches your displayed revision.</p>}</details>;
}
