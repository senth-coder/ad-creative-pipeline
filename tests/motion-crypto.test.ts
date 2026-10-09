import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sealMotion,openMotion} from '../lib/motion-crypto';
test('Motion credential encryption is randomized, authenticated and bound to its record',()=>{process.env.AUTH_SECRET='test-only-'.repeat(8);const data={access_token:'test-secret'};const a=sealMotion(data,'connection');const b=sealMotion(data,'connection');assert.notEqual(a,b);assert.ok(!a.includes('test-secret'));assert.deepEqual(openMotion(a,'connection'),data);assert.throws(()=>openMotion(a,'another-record'));const p=a.split('.');p[2]=Buffer.from('tampered').toString('base64url');assert.throws(()=>openMotion(p.join('.'),'connection'));});
