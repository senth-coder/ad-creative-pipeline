import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {deliveryReceiptSchema,receiptProblem,receiptKey,driveReady} from '../lib/delivery';
import {verifySignature} from '../lib/signature';
const batch={mediaBuyerSlackId:'UBUYER',driveFolderId:'folder',items:[{id:'a',finalName:'GG_STATIC_a_1x1_v01.png',driveFileId:null,status:'PENDING'}]};
test('delivery requires exact names, positive bytes, all files and correct buyer',()=>{
 const receipt={id:'e',type:'drive.item_verified' as const,itemId:'a',driveFileId:'file',finalName:batch.items[0].finalName,bytes:5,driveFolderId:'folder'};
 assert.equal(deliveryReceiptSchema.safeParse({...receipt,bytes:0}).success,false);
 assert.equal(receiptProblem(receipt,batch),null);
 assert.match(receiptProblem({...receipt,finalName:'wrong'},batch)!,/filename/);
 assert.match(receiptProblem({id:'s',type:'slack.dm_confirmed',receiptId:'ts',recipientSlackId:'UBUYER'},batch)!,/every/);
 const ready={...batch,items:[{...batch.items[0],driveFileId:'file',status:'DRIVE_VERIFIED'}]};
 assert.equal(driveReady(ready),true);
 assert.match(receiptProblem({...receipt,driveFileId:'other'},ready)!,/different/);
 assert.match(receiptProblem({id:'s',type:'slack.dm_confirmed',receiptId:'ts',recipientSlackId:'OTHER'},ready)!,/wrong/);
 assert.equal(receiptProblem({id:'s',type:'slack.dm_confirmed',receiptId:'ts',recipientSlackId:'UBUYER'},ready),null);
 assert.notEqual(receiptKey('batch1','e'),receiptKey('batch2','e'));
});
test('signature parser rejects trailing garbage and tampered body',()=>{
 const digest=createHmac('sha256','test').update('body').digest('hex');
 assert.equal(verifySignature('body',digest,'test'),true);
 assert.equal(verifySignature('body',digest+'zz','test'),false);
 assert.equal(verifySignature('other',digest,'test'),false);
 assert.equal(verifySignature('body',digest,undefined),false);
});
