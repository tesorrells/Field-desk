"use client";
import {useMemo} from 'react';
import type {Portfolio} from '../lib/locations';
import type {SharedGroup,SharedPackage} from '../lib/sharing-schema';
import {MAX_STUDY_BYTES,MAX_SHARED_BYTES,MAX_SHARED_GROUPS,MAX_GROUP_RECORDS,MAX_RECORD_REVISIONS,MAX_RECORD_REVIEWS} from '../lib/sharing-limits';
const mb=(bytes:number)=>(bytes/1_000_000).toFixed(2)+' MB';
export default function SharingCapacity({portfolio,group,package:pkg}:{portfolio:Portfolio;group?:SharedGroup;package?:SharedPackage|null}){
 const bytes=useMemo(()=>new TextEncoder().encode(JSON.stringify(portfolio)).length,[portfolio]),packageBytes=useMemo(()=>pkg?new TextEncoder().encode(JSON.stringify(pkg)).length:0,[pkg]);
 return <details className="backup-card"><summary>Storage & sharing capacity · {mb(bytes)} / 16 MB</summary><p>Saved-study limit: {mb(bytes)} / {mb(MAX_STUDY_BYTES)} · {portfolio.sharing.groups.length} / {MAX_SHARED_GROUPS} groups. Save is explicit; capacity measures the current on-screen study.</p><progress aria-label="Study storage capacity" max={MAX_STUDY_BYTES} value={bytes}/>{bytes>MAX_STUDY_BYTES*.8&&<p className="notice">Study storage is nearing its limit. Export a private backup before reorganizing content. History is never trimmed automatically.</p>}{group&&<><p>{group.records.length} / {MAX_GROUP_RECORDS} contributions in this group. Each contribution supports {MAX_RECORD_REVISIONS} revisions and {MAX_RECORD_REVIEWS} reviews.</p>{group.records.filter(r=>r.revisions.length>=MAX_RECORD_REVISIONS*.8||r.reviews.length>=MAX_RECORD_REVIEWS*.8).map(r=><p className="notice" key={r.id}>{r.revisions[0].payload.name}: {r.revisions.length}/{MAX_RECORD_REVISIONS} revisions · {r.reviews.length}/{MAX_RECORD_REVIEWS} reviews</p>)}</>}{pkg&&<p>Current unsigned export: {mb(packageBytes)} / {mb(MAX_SHARED_BYTES)}. Signed exports add proof/envelope bytes and are checked separately.</p>}</details>;
}
