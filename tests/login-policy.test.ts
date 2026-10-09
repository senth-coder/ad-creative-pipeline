import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceLogin} from '../lib/login-policy';
test('verified Ghost Growth accounts enroll with normalized exact-domain emails',()=>{assert.deepEqual(workspaceLogin(' Person@GhostGrowth.io ',true),{email:'person@ghostgrowth.io',autoEnroll:true});});
test('unverified, malformed and lookalike domains cannot enroll',()=>{for(const email of ['person@gmail.com','person@ghostgrowth.io.attacker.com','person@sub.ghostgrowth.io','@ghostgrowth.io','a@b@ghostgrowth.io'])assert.equal(workspaceLogin(email,true),null);for(const verified of [false,undefined,'true'])assert.equal(workspaceLogin('person@ghostgrowth.io',verified),null);});
test('other explicitly allowed domains still require existing membership',()=>{assert.deepEqual(workspaceLogin('person@partner.io',true,'partner.io'),{email:'person@partner.io',autoEnroll:false});});
