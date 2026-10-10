"use client";
import {useState,type ReactNode} from 'react';
export default function SharedLazyDetails({summary,children,className}:{summary:ReactNode;children:()=>ReactNode;className?:string}){
 const [open,setOpen]=useState(false);
 return <details className={className} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{summary}</summary>{open&&children()}</details>;
}
