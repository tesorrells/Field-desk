"use client";
import type {ReactNode} from 'react';
const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,v=>v.toUpperCase());
function Content({value}:{value:unknown}):ReactNode {
 if(value===null)return <span className="help">Not supplied</span>;
 if(Array.isArray(value))return value.length?<ol>{value.map((v,i)=><li key={i}><Content value={v}/></li>)}</ol>:<span className="help">None supplied</span>;
 if(typeof value==='object')return <dl className="shared-document-fields">{Object.entries(value as object).map(([key,v])=><div key={key}><dt>{label(key)}</dt><dd><Content value={v}/></dd></div>)}</dl>;
 if(typeof value==='string'&&/^https?:\/\//i.test(value))return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
 return <span>{String(value||'Not supplied')}</span>;
}
export default function SharedDocument({content}:{content:object}){return <details><summary>Read shared snapshot</summary><Content value={content}/></details>;}
