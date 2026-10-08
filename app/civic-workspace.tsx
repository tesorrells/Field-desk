"use client";
import {CalendarDays,Landmark} from 'lucide-react';
import CivicPanel from './civic-panel';
import JurisdictionsPanel from './jurisdictions-panel';
import type {CivicItem} from '../lib/civic';
import type {JurisdictionMatch,JurisdictionSnapshot} from '../lib/jurisdictions';
import type {Point} from '../lib/geo';
export default function CivicWorkspace({view,setView,home,address,placeEvent,placeNote,inspect}:{view:string,setView:(view:string)=>void,home:Point|null,address:string,placeEvent:(item:CivicItem)=>void,placeNote:(title:string,detail:string)=>void,inspect:(match:JurisdictionMatch,snapshot:JurisdictionSnapshot)=>void}){return <div className="civic-workspace"><div className="civic-workspace-tabs" role="group" aria-label="Civic workspace"><button className={view==='calendar'?'active':''} aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}><CalendarDays size={17}/>Meetings & projects</button><button className={view==='jurisdictions'?'active':''} aria-pressed={view==='jurisdictions'} onClick={()=>setView('jurisdictions')}><Landmark size={17}/>Jurisdictions & contacts</button></div>{view==='jurisdictions'?<JurisdictionsPanel home={home} address={address} placeNote={placeNote} inspect={inspect}/>:<CivicPanel key={home?.join(',')||'none'} point={home} placeNote={placeEvent}/>}</div>;}
