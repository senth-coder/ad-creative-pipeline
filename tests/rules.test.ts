import assert from 'node:assert/strict';
import test from 'node:test';
import { adSetFolder, jobName, sourceAssetName, uploadName } from '../lib/naming';
import { seedJobs, transition } from '../lib/workflow';

const fields={clientCode:'GGMAX',jobNumber:500,version:1,variant:'A',mediaFormat:'VIDEO',jobType:'NEW',product:'SEMA',openEntry:'NEWHOOKS',creativeStyle:'LISTICLE',persona:'FIRST-TIME-USER',funnelStage:'BOF',baseJob:'B100',date:new Date('2025-03-18T12:00:00Z')};
test('protocol job example keeps job, version and variant distinct',()=>{
 assert.equal(jobName(fields),'GGMAX500V1A_VIDEO_NEW_SEMA_NEWHOOKS_LISTICLE_FIRST-TIME-USER_BOF');
 assert.equal(adSetFolder(1),'ADSET 1');
 assert.equal(sourceAssetName(fields),'500V1A_VIDEO_NEW_SEMA_NEWHOOKS_LISTICLE_FIRST-TIME-USER_B100');
 assert.equal(uploadName(fields,'adset'),'03.18.2025-500V1_VIDEO_NEW_SEMA_NEWHOOKS_LISTICLE_FIRST-TIME-USER_B100');
 assert.equal(uploadName(fields,'ad'),'03.18.2025-500V1A_VIDEO_NEW_SEMA_NEWHOOKS_LISTICLE_FIRST-TIME-USER_B100');
});
test('workflow rejects skipping review and manual delivery',()=>{
 const job=seedJobs[0];
 assert.throws(()=>transition(job,'Approved','Tester'));
 assert.throws(()=>transition(job,'Delivered','Tester'));
 assert.equal(transition(job,'In Production','Tester').status,'In Production');
});
