import assert from 'node:assert/strict';
import {haysParcelRow,pucRow,haysClosureRow,fetchHaysParcels,fetchPuc,fetchHaysClosures} from '../lib/hays-data.ts';
import {combineSources,arcgisArea} from '../lib/arcgis-area.ts';
import {packsForArea} from '../lib/local-source-packs.ts';
import {regionalCoverage} from '../lib/source-regions.ts';
import {parseHaysCourt,parseWimberley,collectCivic,civicSourcesForCounty} from '../lib/civic.ts';
import {collectJurisdictions,jurisdictionSourcesForCounty,jurisdictionContacts} from '../lib/jurisdictions.ts';
const geometry={type:'Polygon',coordinates:[[[-98.12,29.99],[-98.1,29.99],[-98.1,30.01],[-98.12,30.01],[-98.12,29.99]]]};
const parcel=haysParcelRow({geometry,properties:{OBJECTID:1,prop_id_text:'123',file_as_name:'Recorded owner',situs_num:'10',situs_street:'PUBLIC',situs_street_sufix:'RD',addr_line1:'Do not collect mailing address',market:0,owner_tax_yr:2026}});
assert.equal(parcel.id,'hcad:123');assert.equal(parcel.property.address,'10 PUBLIC RD');assert.equal(parcel.property.marketValue,0);assert.equal(parcel.property.taxYear,2026);assert.equal(parcel.property.appraisalYear,null);assert.equal(parcel.property.appraisedValue,undefined);assert(!JSON.stringify(parcel).includes('mailing address'));
assert.throws(()=>haysParcelRow({geometry:{type:'Point',coordinates:[-98.1,30]},properties:{OBJECTID:1}}),/polygon/);
const utility=pucRow({geometry,properties:{OBJECTID:1,UTILITY:'Published utility',CCN_NO:'10000'}},'water');assert.equal(utility.id,'puc-water:1');assert.match(utility.detail,/not pipe/);assert.match(utility.status,/unavailable/);
const closure=haysClosureRow({geometry:{type:'Point',coordinates:[-98.1,30]},properties:{OBJECTID:1,activeincid:'No',street:'Public road'}});assert.equal(closure.closure.state,'Unknown');assert.match(closure.detail,/not establish.*open/);
assert.equal(haysClosureRow({geometry:{type:'Point',coordinates:[-98.1,30]},properties:{OBJECTID:1,activeincid:'Yes'}}).closure.state,'Closed');
const overlap=[30.2,-98,30.3,-97.8];assert.equal(packsForArea(overlap).length,2);assert(regionalCoverage('parcels',[29.99,-98.12,30.01,-98.1]).available);assert(!regionalCoverage('parcels',[40,-105,40.1,-104.9]).available);assert(regionalCoverage('water',[33,-97,33.1,-96.9]).available);
const combined=await combineSources([{name:'Good county',run:async()=>({rows:[parcel],complete:true,limit:4000,fetchedAt:'2026-10-07'})},{name:'Failed county',run:async()=>{throw Error('timeout');}}]);assert.equal(combined.rows.length,1);assert.equal(combined.complete,false);assert.match(combined.warning,/Failed county.*timeout/);
await assert.rejects(combineSources([]),/No connected/);await assert.rejects(combineSources([{name:'A',run:async()=>{throw Error('offline');}}]),/offline/);
let queries=0;const paged=await arcgisArea('https://official.invalid/0',overlap,'*',async u=>{if(String(u).includes('/query')){queries++;return Response.json({features:[{}],exceededTransferLimit:true});}return Response.json({editingInfo:{dataLastEditDate:0}});});assert.equal(queries,4);assert.equal(paged.complete,false);
assert.deepEqual(civicSourcesForCounty('48209').map(s=>s.id),['wimberley','hays-court']);assert.equal(civicSourcesForCounty('00000').length,0);assert(jurisdictionSourcesForCounty('48209').every(s=>s.id.startsWith('hays-')));
const court=parseHaysCourt('<html>42972<table><tr><td>October 27, 2026*</td><td>Commissioners Court Regular</td></tr><tr><td><a href="/agenda_publish.cfm&#x3f;id&#x3d;42972&amp;seq&#x3d;140">October 13, 2026</a></td><td>Commissioners Court Regular</td></tr><tr><td>October 12, 2026</td><td>Another board</td></tr></table></html>');assert.equal(court.items.length,2);assert.equal(court.items[0].agendaUrl,undefined);assert.equal(court.items[0].time,null);assert.match(court.items[1].agendaUrl,/\?id=42972&seq=140/);
const city=parseWimberley({value:[{id:1,eventName:'City Council Meeting',startDateTime:'2026-10-15T18:00:00Z',categoryName:'City Council',publishedFiles:[{type:'Agenda'}]}]});assert.equal(city.items[0].sourceId,'wimberley');assert.match(city.items[0].url,/wimberleytx/);assert.match(city.items[0].time,/18:00 Central/);
assert.equal(jurisdictionContacts([{sourceId:'hays-commissioner',data:{matches:[{name:'Precinct 1',sourceId:'hays-commissioner',code:'1',contains:true,nearBoundary:false}]}}]).length,0,'Hays precinct must not get a Travis office');
let pages=0;const paginatedCity=await collectCivic('wimberley',async()=>{pages++;return Response.json({value:[{id:pages,eventName:'City Council Meeting',startDateTime:'2026-10-15T18:00:00Z',categoryName:'City Council'}],...(pages===1?{'@odata.nextLink':'https://wimberleytx.api.civicclerk.com/v1/Events?cursor=2'}:{})});});assert.equal(pages,2);assert.equal(paginatedCity.items.length,2);await assert.rejects(collectCivic('wimberley',async()=>Response.json({value:[], '@odata.nextLink':'https://unexpected.invalid/events'})),/Unexpected official item link/);
console.log('Local pack checks passed: source selection, county failure/caps, parcel provenance, utility eligibility, closure semantics and official calendar dates.');
if(process.argv.includes('--live')){
 const box=[29.994,-98.112,30.002,-98.102];
 for(const [name,run] of [['Hays parcels',()=>fetchHaysParcels(box)],['PUC water',()=>fetchPuc('water',box)],['PUC sewer',()=>fetchPuc('sewer',box)],['Hays closure points',()=>fetchHaysClosures(box)],['Wimberley calendar',()=>collectCivic('wimberley')],['Hays court',()=>collectCivic('hays-court')],...jurisdictionSourcesForCounty('48209').filter(s=>s.id!=='hays-esd').map(s=>[s.id,()=>collectJurisdictions(s.id,[29.997,-98.105])])]){
  const d=await run(),rows=d.rows||d.items||d.matches;console.log(name,JSON.stringify({count:rows.length,complete:d.complete,edited:d.updatedDate||d.serviceUpdated}));if(name==='Hays parcels'||name==='PUC water')assert(rows.length>0);
 }
}
