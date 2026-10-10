"use client";
import {useState} from 'react';
export default function PeerOnboarding({identityReady,contacts,peers,grants}:{identityReady:boolean;contacts:{id:string;label:string;status:string}[];peers:{memberId?:string}[];grants:{recipientId?:string}[]}){
 const [step,setStep]=useState(0),[contactId,setContactId]=useState('');
 const contact=contacts.find(c=>c.id===contactId),incoming=peers.filter(p=>p.memberId===contactId).length,outgoing=grants.filter(g=>g.recipientId===contactId).length;
 const steps=[
  {title:'Prepare both local instances',text:'Set contributor names and save studies. Start pnpm sync --tailscale on both computers. Use Remote setup & connectivity below to check the local connection. Each user keeps the main app on localhost.',done:identityReady},
  {title:'Exchange and verify identity cards',text:'Open Your signed identity below. Send only the public card to your peer. Add their card in Contacts and compare the entire fingerprint through a separate trusted channel before verifying.',done:contact?.status==='Verified'},
  {title:'Choose what you will publish',text:'Stage and save contributions, then select export records. Preview the signed package in Publish selected contributions. Create an invitation for the verified contact. New records require explicit selection.',done:outgoing>0},
  {title:'Connect the invitation from your peer',text:'Your peer creates their own invitation for you. Paste it in Connect to a coworker or neighbor below and verify the publisher fingerprint. An outgoing invitation never grants reciprocal access automatically.',done:incoming>0},
  {title:'Test, pull and review',text:'Use Test signed connection under Connected peers, then Sync now. Inspect the inbox, merge selected content and Save study. Use Sharing permissions to inspect each direction. Setup indicators apply to the selected contact; inspect the intended group in Sharing permissions.',done:false}
 ];
 const item=steps[step];
 return <details><summary>Set up sharing with a coworker or neighbor</summary><label>Set up with contact<select value={contactId} onChange={e=>{setContactId(e.target.value);setStep(0);}}><option value="">Choose a contact, or add one in Contacts below</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.label} · {c.status}</option>)}</select></label><ol>{steps.map((s,i)=><li key={s.title}><button aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}>{i+1}. {s.title}{s.done?' · Configured locally':''}</button></li>)}</ol><h4>{item.title}</h4><p>{item.text}</p><div className="row"><button disabled={step===0} onClick={()=>setStep(step-1)}>Previous step</button><button disabled={step===steps.length-1} onClick={()=>setStep(step+1)}>Next step</button></div><p>These local setup indicators do not certify that a remote peer is reachable. Both companions must be running to exchange data.</p></details>;
}
