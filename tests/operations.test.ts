import assert from 'node:assert/strict';
import test from 'node:test';
import {cycleWindow,duplicateCandidates,emptyOperations,intakeSchema,launchSchema,operationsSchema,qaChecks,reviewReadiness,validateLaunch,type Intake} from '../lib/operations';
import {seedJobs,transition,type Job} from '../lib/workflow';
const production:Job={...seedJobs[1],operations:emptyOperations()};
test('QA checklist gates internal review and blockers prevent progress',()=>{
 assert.match(reviewReadiness(production,'Internal Review')!,/six/);
 const ready={...production,operations:{...emptyOperations(),checklist:qaChecks.map(([key])=>key)}};
 assert.equal(reviewReadiness(ready,'Internal Review'),null);
 assert.match(reviewReadiness({...ready,operations:{...ready.operations,blockerReason:'Missing packaging'}},'Internal Review')!,/blocker/);
 assert.match(reviewReadiness({...ready,reviewUrl:''},'Internal Review')!,/review link/);
 assert.match(reviewReadiness(seedJobs[0],'In Production')!,/Assign/);
});
test('revision records require a feedback reference and date; returning resets checklist',()=>{
 const reviewed={...production,status:'Internal Review' as const,operations:{...emptyOperations(),checklist:qaChecks.map(([key])=>key)}};
 assert.throws(()=>transition(reviewed,'In Production','QA'),/revision/);
 const updated=transition({...reviewed,operations:{...reviewed.operations,revisionReason:'Fix packaging',approvalEvidenceUrl:'https://slack.com/old-approval',feedbackUrl:'https://frame.io/review/123',revisionDue:'2026-10-10'}},'In Production','QA');
 assert.deepEqual(updated.operations?.checklist,[]);
 assert.equal(updated.operations?.approvalEvidenceUrl,'');
 assert.equal(updated.operations?.revisionReason,'Fix packaging');
});
test('external approval evidence is distinct from a review URL',()=>{
 const job={...production,status:'Client Review' as const};
 assert.throws(()=>transition(job,'Approved','Strategist'),/approval/);
 assert.equal(transition({...job,operations:{...emptyOperations(),approvalEvidenceUrl:'https://slack.com/approval'}},'Approved','Strategist').status,'Approved');
});
test('weekly and fortnightly target windows roll on exact boundaries',()=>{
 assert.deepEqual(cycleWindow('2026-10-01',7,'2026-10-07'),{from:'2026-10-01',until:'2026-10-08'});
 assert.deepEqual(cycleWindow('2026-10-01',7,'2026-10-08'),{from:'2026-10-08',until:'2026-10-15'});
 assert.deepEqual(cycleWindow('2026-10-01',14,'2026-10-20'),{from:'2026-10-15',until:'2026-10-29'});
});
test('launching requires delivery, correct variant, links and dates',()=>{
 const record=launchSchema.parse({jobId:'a',variantCode:'A',platform:'Meta',account:'GG',status:'Live',plannedAt:'',launchedAt:'',destinationUrl:'',adUrl:'',campaign:'',adSet:'',notes:''});
 assert.match(validateLaunch(record,production)!,/delivered/);
 assert.match(validateLaunch(record,{status:'Delivered',variants:['B']})!,/Variant/);
 assert.match(validateLaunch(record,{status:'Delivered',variants:['A']})!,/actual launch/);
 assert.equal(validateLaunch({...record,launchedAt:'2026-10-08',destinationUrl:'https://example.com',adUrl:'https://facebook.com/ad/123'},{status:'Delivered',variants:['A']}),null);
});
test('normalized intake retains repeated offers and flags possible duplicates',()=>{
 const payload=intakeSchema.parse({id:'submission-1',title:'Autumn offer',client:'GG',offers:[{name:'Offer 1',price:'$10'},{name:'Offer 2',price:'$20'}]});
 assert.equal(payload.offers.length,2);
 const event:Intake={id:'1',externalId:'tally:1',provider:'tally',receivedAt:'2026-10-08',payload};
 const duplicate={...event,id:'2',provider:'slack',payload:{...payload,title:' AUTUMN OFFER '}};
 assert.deepEqual(duplicateCandidates(event,[event,duplicate]).map(i=>i.id),['2']);
 assert.equal(duplicateCandidates(event,[{...duplicate,dismissedAt:'2026-10-08'}]).length,0);
 assert.equal(intakeSchema.safeParse({...payload,sourceUrl:'javascript:alert(1)'}).success,false);
 assert.equal(operationsSchema.safeParse({feedbackUrl:'javascript:alert(1)'}).success,false);
});
