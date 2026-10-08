import assert from 'node:assert/strict';
import {parcelRow,fetchParcels} from '../lib/parcels.ts';
import {parcelIntersects} from '../lib/geo.ts';
const box=(w,s,e,n)=>[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
const geometry={type:'Polygon',coordinates:box(-97.6,30.3,-97.5,30.4)};
const feature={geometry,properties:{PROP_ID:123,situs_address:'Test property',market_value:0,tcad_acres:null,hyperlink:'javascript:bad'}};
const row=parcelRow(feature);assert.equal(row.property.marketValue,0);assert.equal(row.property.acres,undefined);assert.equal(row.property.appraisalYear,null);assert.equal(row.url,'https://traviscad.org/propertysearch');
const unknown=parcelRow({...feature,properties:{OBJECTID:99,PROP_ID:null}});assert.equal(unknown.id,'tcad:object:99');assert.equal(unknown.property.id,'Unavailable');
// Boundary cuts an edge even though the parcel's center is outside.
const boundary=[[30.35,-97.51],[30.35,-97.49],[30.36,-97.49],[30.36,-97.51]];
assert(parcelIntersects(geometry,boundary));assert(!parcelIntersects(geometry,[[30.5,-97.7],[30.5,-97.6],[30.6,-97.6]]));
const hole={type:'Polygon',coordinates:[...geometry.coordinates,...box(-97.58,30.32,-97.52,30.38)]};
assert(!parcelIntersects(hole,[[30.34,-97.56],[30.34,-97.55],[30.35,-97.55],[30.35,-97.56]]));
assert(parcelIntersects({type:'MultiPolygon',coordinates:[geometry.coordinates]},boundary));
let calls=0;let result=await fetchParcels([30.3,-97.6,30.4,-97.5],async url=>{assert.equal(new URL(url).searchParams.get('resultOffset'),String(calls*1000));calls++;return Response.json({features:[{...feature,properties:{...feature.properties,PROP_ID:calls}}],exceededTransferLimit:calls===1});});assert.equal(calls,2);assert(result.complete);assert.equal(result.rows.length,2);
calls=0;result=await fetchParcels([30.3,-97.6,30.4,-97.5],async()=>{calls++;return Response.json({features:[feature],exceededTransferLimit:true});});assert.equal(calls,4);assert(!result.complete);
await assert.rejects(fetchParcels([30.3,-97.6,30.4,-97.5],async()=>Response.json({error:{message:'Unavailable'}})),/could not return/);
console.log('Parcel checks passed: boundary intersection, holes, multi-polygons, null/zero values, links, pagination, cap, and source failure.');
