import assert from 'node:assert/strict';
import {cacheView,uncovered,missingExtent} from '../lib/area-cache.ts';
import {splitSnapshot,assembleSnapshots,serializeSnapshotRecords,decodeSnapshotRecords} from '../lib/snapshot-chunks.ts';
const now=Date.parse('2026-10-06T20:00:00Z');
const make=(bbox,rows=[],minutes=0,complete=true)=>({bbox,rows,fetchedAt:new Date(now-minutes*60000).toISOString(),complete});
const p=(id,lat,lng)=>({id,lat,lng,name:id});
const big=[30,-98,31,-97],small=[30.2,-97.8,30.8,-97.2];
let d=cacheView('resources',small,[make(big,[p('inside',30.5,-97.5),p('outside',30.9,-97.1)])],now);
assert.equal(d.coverage,100);assert.equal(d.rows.length,1);assert.equal(d.missing.length,0);
d=cacheView('resources',big,[make([30,-98,31,-97.5],[p('a',30.5,-97.8)])],now);
assert.equal(d.coverage,50);assert.deepEqual(missingExtent(d.missing),[30,-97.5,31,-97]);
d=cacheView('resources',big,[make([30,-98,31,-97.5]),make([30,-97.5,31,-97])],now);assert.equal(d.coverage,100);
d=cacheView('resources',big,[make(big,[p('x',30.5,-97.5)],0,false)],now);assert.equal(d.coverage,0);assert.equal(d.rows.length,1);
d=cacheView('traffic',big,[make(big,[p('x',30.5,-97.5)],3)],now);assert(d.stale);assert.equal(d.coverage,0);
d=cacheView('resources',big,[make(big,[p('x',30.5,-97.5)],1500)],now);assert(d.stale);assert.equal(d.rows.length,1);
// A newer complete empty result supersedes older traffic reports in its extent.
d=cacheView('traffic',big,[make(big,[],0),make(big,[p('resolved',30.5,-97.5)],1)],now);assert.equal(d.rows.length,0);
d=cacheView('resources',big,[make([30,-98,30.5,-97],[]),make(big,[p('keep',30.8,-97.5),p('drop',30.2,-97.5)],1)],now);assert.deepEqual(d.rows.map(x=>x.id),['keep']);
assert.deepEqual(uncovered(big,[big]),[]);
const full=make(big,[p('one',30.5,-97.5),p('two',30.6,-97.6)]),chunks=splitSnapshot(full,80);
const large=make(big,[{...p('large',30.5,-97.5),detail:'a'.repeat(900000)}]),fragments=serializeSnapshotRecords(large);assert(fragments.length>1);assert.deepEqual(decodeSnapshotRecords(fragments),[large]);assert.deepEqual(decodeSnapshotRecords(fragments.slice(1)),[]);assert.deepEqual(decodeSnapshotRecords(chunks)[0].rows,full.rows);
assert.equal(chunks.length,2);assert.deepEqual(assembleSnapshots(chunks)[0].rows,full.rows);assert(assembleSnapshots(chunks)[0].complete);assert(!assembleSnapshots(chunks.slice(0,1))[0].complete);assert.equal(assembleSnapshots([full])[0],full);
// Include crossing parcels whose center lies outside the new search extent.
const parcel={id:'parcel',lat:30.5,lng:-97.5,geometry:{type:'Polygon',coordinates:[[[-97.8,30.2],[-97.2,30.2],[-97.2,30.8],[-97.8,30.8],[-97.8,30.2]]]}};
d=cacheView('parcels',[30.7,-97.3,30.9,-97.1],[make(big,[parcel])],now);assert.equal(d.rows.length,1);assert.equal(d.coverage,100);
console.log('Area cache checks passed: nested, partial overlap, union coverage, capped results, stale fallback and superseded records.');
