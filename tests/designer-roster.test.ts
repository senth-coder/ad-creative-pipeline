import {test} from 'node:test';
import assert from 'node:assert/strict';
import {designerOptions,designerRoster} from '../lib/designer-roster';
test('Notion labels map to known accounts without admitting unrelated automatic signups',()=>{const rows=designerOptions(['Preston Yarger','Xyrus Afable','Someone Else','Marc Padlan']);assert.deepEqual(rows.map(r=>r.label),designerRoster);assert.equal(rows[0].value,'Preston Yarger');assert.equal(rows[7].value,'Xyrus Afable');assert.equal(rows[2].value,'Marc Padlan');assert.equal(rows[1].available,false);});
test('ambiguous or unconfirmed identities cannot be assigned',()=>{const rows=designerOptions(['Marc','Marc Padlan','Justin Yaldoo']);assert.equal(rows[2].available,false);assert.equal(rows.some(r=>String(r.label)==='Justin'),false);});
