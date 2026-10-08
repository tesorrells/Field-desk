import assert from 'node:assert/strict';
import {collectionFetch,activitySnapshot,clearFinishedActivity,activityName} from '../lib/collection-activity.ts';
const original=globalThis.fetch;
try{
 assert.equal(activityName('/api/data?kind=parcels&bbox=1,2,3,4'),'County property records');
 assert.equal(activityName('/api/study'),null);
 assert.equal(activityName('https://other.example/api/data?kind=parcels'),null);
 globalThis.fetch=async()=>new Response(JSON.stringify({rows:[{id:'fixture'}],cached:true}),{status:200});
 let response=await collectionFetch('/api/data?kind=parcels&cacheOnly=1');
 assert.equal(activitySnapshot().at(-1).phase,'reading');
 clearFinishedActivity();assert.equal(activitySnapshot().length,1,'Dismissing history retains in-flight requests');
 const parsed=await response.json();assert.equal(parsed.rows[0].id,'fixture');assert.equal(activitySnapshot().at(-1).phase,'complete');assert.match(activitySnapshot().at(-1).detail,/1 records/);
 globalThis.fetch=async()=>new Response(JSON.stringify({rows:[],partial:true,warning:'Some sections unavailable'}));
 response=await collectionFetch('/api/data?kind=parcels');await response.json();assert.equal(activitySnapshot().at(-1).phase,'warning');
 globalThis.fetch=async()=>new Response(JSON.stringify({error:'Upstream unavailable'}),{status:503});
 response=await collectionFetch('/api/civic');assert.equal(activitySnapshot().at(-1).phase,'error');await response.json();assert.equal(activitySnapshot().at(-1).detail,'Upstream unavailable');
 globalThis.fetch=async()=>new Response('invalid JSON');response=await collectionFetch('/api/community');await assert.rejects(()=>response.json());assert.equal(activitySnapshot().at(-1).phase,'error');
 globalThis.fetch=async()=>{throw new DOMException('Cancelled','AbortError');};await assert.rejects(()=>collectionFetch('/api/address?q=public'));assert.equal(activitySnapshot().at(-1).phase,'cancelled');
 clearFinishedActivity();assert.equal(activitySnapshot().length,0);
 console.log('Collection activity passed: private URL exclusion, body-reading phase, cache counts, partial/error responses, parse failures, cancellations and safe dismissal.');
}finally{globalThis.fetch=original;clearFinishedActivity();}
