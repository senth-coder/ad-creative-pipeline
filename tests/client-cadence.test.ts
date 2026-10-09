import test from 'node:test';
import assert from 'node:assert/strict';
import {cadenceWindow,cadenceProgress,defaultSchedule,deliveryScheduleSchema} from '../lib/client-cadence';
import {seedJobs} from '../lib/workflow';
import {planSchema} from '../lib/operations';
test('monthly cycles retain the original anchor across short months and leap years',()=>{
 const s={...defaultSchedule('2024-01-31').statics,enabled:true,cadence:'monthly' as const};
 assert.deepEqual(cadenceWindow(s,'2024-02-29'),{from:'2024-02-29',until:'2024-03-31',through:'2024-03-30',upcoming:false});
 assert.equal(cadenceWindow(s,'2024-03-31').until,'2024-04-30');
});
test('weekly and biweekly targets have independent anchors and future cycles stay upcoming',()=>{
 const s=defaultSchedule('2026-10-12');assert.equal(cadenceWindow(s.statics,'2026-10-09').upcoming,true);
 assert.equal(cadenceWindow(s.statics,'2026-10-19').from,'2026-10-19');
 assert.equal(cadenceWindow(s.videos,'2026-10-19').from,'2026-10-12');
});
test('delivery progress uses Toronto completion date, format, client and delivered variants',()=>{
 const s={...defaultSchedule('2026-10-05').statics,enabled:true,target:6};const base={...seedJobs[0],client:'A',type:'Static' as const,variants:['A','B'],status:'Delivered' as const,deliveredAt:'2026-10-12T02:00:00Z'};
 const jobs=[base,{...base,id:'video',type:'Video' as const},{...base,id:'other',client:'B'},{...base,id:'future',deliveredAt:'2026-10-12T05:00:00Z'},{...base,id:'open',status:'In Production' as const,due:'2026-10-09',variants:['A']}];
 const p=cadenceProgress(jobs,'A','statics',s,'2026-10-09');assert.equal(p.delivered,2);assert.equal(p.planned,1);assert.equal(p.remaining,4);assert.equal(p.unplanned,3);
});
test('cadence input rejects invalid targets and preserves older client plan payloads',()=>{
 const s=defaultSchedule();assert.equal(deliveryScheduleSchema.safeParse({...s,statics:{...s.statics,target:0}}).success,false);
 const old={clientId:'A',cycleStart:'2026-10-09',cadenceDays:7,targetJobs:0,targetVariants:0,formatMix:'',approverEmail:'',releaseOwnerEmail:'',notes:''};
 assert.equal(planSchema.parse(old).priority,undefined);assert.equal(planSchema.safeParse({...old,priority:'VIP'}).success,false);
});
import {launchSummary} from '../lib/launch-summary';
test('delivery does not imply launch; all variants must be live and duplicate platform records count once',()=>{
 assert.equal(launchSummary(['A','B'],[]).launchState,'Awaiting launch');
 assert.equal(launchSummary(['A','B'],[{variantCode:'A',status:'Live'},{variantCode:'A',status:'Live'}]).launchState,'Partially launched');
 assert.equal(launchSummary(['A','B'],[{variantCode:'A',status:'Live'},{variantCode:'B',status:'Live'}]).launchState,'Launched');
 assert.equal(launchSummary(['A'],[{variantCode:'A',status:'Paused'}]).launchState,'Paused');
});
