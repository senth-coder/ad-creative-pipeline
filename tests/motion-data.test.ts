import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionWorkspaces,motionReports,unpackMotion} from '../lib/motion-data';
test('Motion workspace parsing retains organization and does not invent mappings',()=>{assert.deepEqual(motionWorkspaces({organizations:[{id:'org',name:'Agency',workspaces:[{id:'one',name:'Client A'}]}]}),[{id:'one',name:'Client A',organizationId:'org'}]);assert.deepEqual(motionWorkspaces({user:{id:'user',name:'Admin'}}),[]);});
test('Motion reports only accept HTTPS links and handle MCP errors',()=>{assert.deepEqual(motionReports({reports:[{id:'r1',name:'Winners',reportUrl:'javascript:alert(1)'}]}),[{id:'r1',name:'Winners',url:undefined,type:undefined}]);assert.deepEqual(unpackMotion({content:[{type:'text',text:'{"reports":[]}'}]}),{reports:[]});assert.throws(()=>unpackMotion({isError:true,content:[]}));});
