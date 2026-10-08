import assert from 'node:assert/strict';
import {collectionSchema,evidenceSnapshot,newQuestion,questionFlags} from '../lib/collection.ts';

// Legacy studies have no collection planner; each receives an independent default.
const first=collectionSchema.parse(undefined),second=collectionSchema.parse(undefined);
first.purpose='First study';
assert.equal(second.purpose,'');
assert.deepEqual(second.questions,[]);

const record={id:'crossing-1',name:'Crossing observation',source:'Field note',date:'2026-10-07',detail:'Water over roadway',url:'https://example.org/report',confidence:'Observed directly'};
const evidence=evidenceSnapshot(record,'Note');
record.detail='Later observation: water receded';
assert.equal(evidence.detail,'Water over roadway');
const question={...newQuestion(),neededBy:'2026-10-06',reviewOn:'2026-10-07',evidence:[{...evidence,stance:'Conflicts'}]};
const plan=collectionSchema.parse({purpose:'Check access',questions:[question]});
assert.deepEqual(collectionSchema.parse(JSON.parse(JSON.stringify(plan))),plan);
assert.deepEqual(questionFlags(question,'2026-10-07'),{overdue:true,reviewDue:true});
assert.deepEqual(questionFlags({...question,status:'Answered'},'2026-10-07'),{overdue:false,reviewDue:true});
assert.deepEqual(questionFlags({...question,neededBy:'',reviewOn:''},'2026-10-07'),{overdue:false,reviewDue:false});
assert.equal(collectionSchema.safeParse({purpose:'',questions:[{...question,reviewOn:'2026-02-30'}]}).success,false);
assert.equal(collectionSchema.safeParse({purpose:'',questions:[{...question,evidence:[{...evidence,url:'javascript:alert(1)'}]}]}).success,false);
assert.equal(collectionSchema.safeParse({purpose:'',questions:[question,question]}).success,false);
assert.equal(collectionSchema.safeParse({purpose:'',questions:[{...question,evidence:Array.from({length:31},()=>evidence)}]}).success,false);
assert.equal(collectionSchema.safeParse({purpose:'',questions:[{...question,question:''}]}).success,false);
console.log('Collection checks passed: legacy defaults, round trip, snapshot independence, deadlines, invalid dates and URLs, duplicate IDs, limits.');
