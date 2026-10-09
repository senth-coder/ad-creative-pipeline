import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetCodes,briefCode,briefPlan,flexibleFields} from '../lib/brief-plan';
test('explicit quantity overrides template output counts for manual and Motion briefs',()=>{assert.deepEqual(briefPlan({assetCount:'1'},['A','B','C','D']),['A']);assert.deepEqual(briefPlan({assetCount:'3',sourceUrl:'https://projects.motionapp.com/'},['A']),['A','B','C']);assert.equal(assetCodes(26)[25],'Z');});
test('invalid asset counts cannot produce empty or ambiguous production plans',()=>{for(const count of [0,-1,27,1.5,NaN])assert.throws(()=>assetCodes(count));assert.throws(()=>briefPlan({assetCount:''},['A']));});
test('legacy callers retain their configured rules and brief codes use the global sequence',()=>{assert.deepEqual(briefPlan({},['B','D']),['B','D']);assert.equal(briefCode(501),'GG-BR-00501');assert.equal(briefCode(100001),'GG-BR-100001');});
test('flexible detail fields retain the required objective',()=>{assert.deepEqual(flexibleFields([{key:'objective',label:'Objective',placeholder:''},{key:'duration',label:'Duration',placeholder:'',required:true}]).map(f=>f.required),[true,false]);});
