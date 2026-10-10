"use client";
import {useEffect,useState} from 'react';
import {Inbox} from 'lucide-react';
import {peerControl} from '../lib/peer-control';
import {useSyncControlPort,type InboxSummary} from '../lib/peer-ui';
export default function FederationStatus({open}:{open:()=>void}){
 const [port]=useSyncControlPort(),[summary,setSummary]=useState<InboxSummary|null>(null),[offline,setOffline]=useState(false);
 useEffect(()=>{let current=true;setSummary(null);setOffline(false);if(window.location.protocol!=='http:'||!['127.0.0.1','localhost'].includes(window.location.hostname))return;async function refresh(){try{const next=await peerControl<InboxSummary>(port,'/inbox-status');if(current){setSummary(next);setOffline(false);}}catch{if(current)setOffline(true);}}void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>{current=false;clearInterval(timer);};},[port]);
 if(!summary)return null;
 return <button className="federation-status" onClick={open} title={offline?'Sync service unavailable; counts are from the last check.':`Last successful sync: ${summary.lastSuccess?new Date(summary.lastSuccess).toLocaleString():'Not yet'} · ${summary.deferred} deferred · ${summary.errors} peer errors`}><Inbox size={16}/>{offline?'Inbox offline':`Inbox · ${summary.pending} pending`}{!offline&&summary.errors>0?' · check sync':''}</button>;
}
