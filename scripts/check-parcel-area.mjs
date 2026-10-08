import assert from 'node:assert/strict';
import {loadParcelArea,parcelTiles} from '../lib/parcel-area.ts';
const bbox=[30.36,-97.55,30.38,-97.53],tiles=parcelTiles(bbox);
assert(tiles.length>=4);assert(tiles.every(t=>t[2]-t[0]<=.010001&&t[3]-t[1]<=.010001));
let calls=0,active=0,maxActive=0;const counts=[];
const cached={rows:[],partial:true,missing:[bbox],coverage:0};
let result=await loadParcelArea(bbox,async(b,cacheOnly)=>{if(cacheOnly)return cached;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,1));active--;calls++;return {rows:Array.from({length:1500},(_,i)=>({id:b.join(',')+i})),partial:false,missing:[],fetchedAt:new Date().toISOString()};},d=>counts.push(d.rows.length));
assert.equal(calls,tiles.length);assert(result.rows.length>4000);assert.equal(result.coverage,100);assert(!result.partial);assert(maxActive<=3);assert(counts.some(c=>c>0&&c<result.rows.length));
calls=0;result=await loadParcelArea(bbox,async(b,cacheOnly)=>{calls++;return {...cached,partial:false,missing:[],coverage:100};},()=>{});assert.equal(calls,1);
calls=0;result=await loadParcelArea(bbox,async(b,cacheOnly)=>{if(cacheOnly)return {...cached,rows:[{id:'keep'}]};if(calls++===0)throw Error('Offline');return {rows:[],partial:false,missing:[]};},()=>{});assert(result.partial);assert(result.rows.some(r=>r.id==='keep'));assert.match(result.warning,/could not refresh/);
const controller=new AbortController();calls=0;await loadParcelArea(bbox,async(b,cacheOnly)=>{if(cacheOnly)return cached;calls++;controller.abort();return {rows:[],missing:[],partial:false};},()=>{},controller.signal);assert(calls<=3);
console.log('Area parcel loading passed: more than 4,000 records, progressive sections, concurrency, complete cache reuse, failed-section retention, cancellation.');

let unsupportedCalls=0;const unsupported=await loadParcelArea([30,-98.3,30.01,-98.29],async()=>{unsupportedCalls++;return {unsupported:true,rows:[],partial:true,coverage:0,warning:'Local parcels not connected'};},()=>{});assert.equal(unsupportedCalls,1);assert.equal(unsupported.unsupported,true);assert.match(unsupported.warning,/not connected/);
