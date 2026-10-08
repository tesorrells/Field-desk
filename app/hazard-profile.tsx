import {useState} from 'react';
import {ExternalLink} from 'lucide-react';
import type {NriProfile} from '../lib/hazards';
import {reportDate} from '../lib/report-dates';
const money=(n:number|null)=>n===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export default function HazardProfile({profile,compact=false}:{profile:NriProfile;compact?:boolean}){
 const [all,setAll]=useState(false);
 const sorted=[...profile.hazards].sort((a,b)=>(b.score??-1)-(a.score??-1));
 const rows=!all?sorted.slice(0,6):sorted;
 return <div className="hazard-profile"><span className="eyebrow">FEMA NRI · {profile.level==='county'?'COUNTY':'CENSUS TRACT'}</span><h3>{profile.level==='county'?`${profile.county} County`:`Tract ${profile.tractFips}`}</h3><p className="help">{profile.level==='tract'?`${profile.county} County · `:''}FIPS {profile.level==='county'?profile.countyFips:profile.tractFips}<br/>Dataset release: {profile.version}<br/>Catalog updated: {profile.catalogUpdatedAt?reportDate(profile.catalogUpdatedAt,true):'Unavailable'}</p><p className="help">National relative risk score · 0–100, compared with other {profile.level==='county'?'counties':'census tracts'}. Higher scores mean higher relative risk in this dataset; they are not probabilities of loss.</p>
 <div className="hazard-table" tabIndex={0} role="region" aria-label={`${profile.id} hazard scores`}><table><thead><tr><th>Hazard</th><th>Risk score</th><th>FEMA rating</th>{!compact&&<th>Expected annual loss</th>}</tr></thead><tbody>{rows.map(h=><tr key={h.code}><td>{h.name}</td><td>{h.score===null?<span>Unavailable</span>:<><span>{h.score.toFixed(1)} / 100</span><span className="risk-track" aria-hidden="true"><i style={{width:`${h.score}%`}}/></span></>}</td><td>{h.rating}</td>{!compact&&<td>{money(h.expectedAnnualLoss)}</td>}</tr>)}</tbody></table></div>{<button onClick={()=>setAll(!all)}>{all?'Show highest six scores':'Show all 18 hazards'}</button>}
 <p className="help">{!compact&&'Expected annual loss combines modeled building, agriculture, and monetized population losses across this geography. '}Risk scores also reflect social vulnerability and community resilience. They describe long-term planning context, not active conditions or your parcel’s risk.</p><a href={profile.url} target="_blank" rel="noreferrer">FEMA source layer <ExternalLink size={14}/></a>
 </div>;
}
