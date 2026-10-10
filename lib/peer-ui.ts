"use client";
import {useEffect,useState,useCallback} from 'react';
const portKey='field-desk-sync-control-port';
export function useSyncControlPort(){
 const [port,setPort]=useState('5185');
 useEffect(()=>{const read=()=>{try{const value=localStorage.getItem(portKey);setPort(value!==null&&/^\d{0,5}$/.test(value)?value:'5185');}catch{}};read();window.addEventListener('storage',read);window.addEventListener('field-desk-sync-port',read);return()=>{window.removeEventListener('storage',read);window.removeEventListener('field-desk-sync-port',read);};},[]);
 const change=useCallback((value:string)=>{setPort(value);try{localStorage.setItem(portKey,value);window.dispatchEvent(new Event('field-desk-sync-port'));}catch{}},[]);
 return [port,change] as const;
}
export type InboxEntry={id:string;peerId:string;digest:string;state:'Pending'|'Deferred'|'Dismissed'|'Merged';reason:string;receivedAt:string;lastSeenAt:string;reviewedAt:string|null};
export type InboxSummary={pending:number;deferred:number;lastSuccess:string|null;errors:number};
