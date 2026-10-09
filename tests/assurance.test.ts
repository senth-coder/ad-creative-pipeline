import assert from 'node:assert/strict';
import test from 'node:test';
import {assessAsset,deliveryFilename,emptyGovernance,governanceSchema,metricRates,metricSchema,namingProblem,releaseProblem,routeQa,type AssetInput,type QaPerson,type TrackedAsset} from '../lib/assurance';
const naming={scope:'GG',type:'VIDEO',descriptor:'job500-a',aspect:'9x16',version:1,extension:'mp4' as const};
const asset:AssetInput={variantCode:'A',version:1,briefRevision:2,sourceBriefUrl:'https://docs.google.com/document/d/brief',sourceUrl:'https://frame.io/asset',externalAssetId:'asset-a',naming,copyText:'Compounded semaglutide. Learn more.',revisionNote:'Updated to brief revision 2'};
const governance={...emptyGovernance(),rulesConfirmed:true,guidelinesUrl:'https://example.com/guidelines',rules:[{id:'wording',label:'Required wording',kind:'required_text' as const,phrase:'compounded',sourceUrl:'https://example.com/rules',active:true},{id:'visual',label:'Visual review',kind:'human' as const,phrase:'',sourceUrl:'https://example.com/rules',active:true}]};
test('new filenames are exact, version padded and variant distinct',()=>{
 assert.equal(deliveryFilename(naming),'GG_VIDEO_job500-a_9x16_v01.mp4');
 assert.notEqual(deliveryFilename(naming),deliveryFilename({...naming,descriptor:'job500-b'}));
 assert.throws(()=>deliveryFilename({...naming,descriptor:'../unsafe'}));
 assert.equal(namingProblem('GG_VIDEO_job500-a_9x16_v02.mp4',naming),'Filename does not match the current delivery convention');
});
test('text checks cannot replace human visual and transcript verification',()=>{
 const incomplete=assessAsset(asset,governance,[],true);assert.equal(incomplete.find(f=>f.id==='wording')?.result,'pass');assert.equal(incomplete.find(f=>f.id==='visual')?.result,'human_required');
 assert.ok(assessAsset(asset,governance,['visual'],true).every(f=>f.result==='pass'));
 assert.equal(assessAsset({...asset,copyText:'semaglutide'},governance,['visual'],true).find(f=>f.id==='wording')?.result,'fail');
 assert.equal(assessAsset({...asset,copyText:'uncompounded'},governance,['visual'],true).find(f=>f.id==='wording')?.result,'fail');
 assert.equal(assessAsset(asset,governance,['visual'],false).find(f=>f.id==='copy-verified')?.result,'human_required');
});
test('latest asset version and current client rule revision are required for release',()=>{
 const tracked:TrackedAsset={...asset,id:'a1',filename:deliveryFilename(naming),createdAt:'2026-10-09',review:{policyVersion:2,reviewedAt:'2026-10-09',reviewer:'qa@example.com',humanChecks:['visual'],evidenceUrl:'https://frame.io/review',copyVerified:true,note:'',passed:true}};
 assert.equal(releaseProblem(['A'],[tracked],governance,2),null);
 assert.match(releaseProblem(['A'],[tracked],governance,3)!,/current client rules/);
 assert.match(releaseProblem(['A','B'],[tracked],governance,2)!,/variant B/);
 assert.match(releaseProblem(['A'],[tracked,{...tracked,id:'a2',version:2,review:null}],governance,2)!,/needs QA/);
});
test('QA routing has an explicit backup and fails closed when neither is available',()=>{
 const primary:QaPerson={id:'1',name:'Primary',email:'primary@example.com',role:'QA',slackUserId:'U1',qaUnavailable:false};const backup={...primary,id:'2',name:'Backup',email:'backup@example.com',slackUserId:'U2'};
 const g={...emptyGovernance(),primaryQaEmail:primary.email,backupQaEmail:backup.email,routingConfirmed:true};
 assert.equal(routeQa(g,[primary,backup]).person?.id,'1');
 assert.equal(routeQa(g,[{...primary,qaUnavailable:true},backup]).person?.id,'2');
 assert.equal(routeQa(g,[{...primary,qaUnavailable:true},{...backup,qaUnavailable:true}]).person,null);
 assert.equal(routeQa({...g,routingConfirmed:false},[primary,backup]).person,null);
 assert.equal(governanceSchema.safeParse({...g,backupQaEmail:primary.email}).success,false);
});
test('missing analytics stay unknown while genuine zero results remain zero',()=>{
 const m=metricSchema.parse({assetId:'a1',externalId:'report1',provider:'motion',account:'account',adId:'ad1',sourceUrl:'https://example.com/report',periodStart:'2026-10-01',periodEnd:'2026-10-08',currency:'USD',spend:100,impressions:1000,clicks:10,conversions:null,revenue:null,conversionDefinition:'Purchases, 7 day click',learning:''});
 assert.equal(metricRates(m).cpa,null);assert.equal(metricRates(m).roas,null);assert.equal(metricRates(m).ctr,1);
 assert.equal(metricRates({...m,conversions:2,revenue:0}).cpa,50);assert.equal(metricRates({...m,revenue:0}).roas,0);
 assert.equal(metricSchema.safeParse({...m,periodEnd:'2026-09-01'}).success,false);
});
test('rules need source evidence before activation',()=>{
 assert.equal(governanceSchema.safeParse({...governance,rules:[{...governance.rules[0],sourceUrl:''}]}).success,false);
 assert.equal(governanceSchema.safeParse({...governance,rules:[{...governance.rules[0],phrase:''}]}).success,false);
});
test('exact text checks treat punctuation literally',()=>{
 const g={...governance,rules:[{...governance.rules[0],phrase:'learn more (today)'}]};
 assert.equal(assessAsset({...asset,copyText:'Learn more (today)'},g,[],true).find(f=>f.id==='wording')?.result,'pass');
 assert.equal(assessAsset({...asset,copyText:'Learn more today'},g,[],true).find(f=>f.id==='wording')?.result,'fail');
});
