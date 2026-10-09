import assert from 'node:assert/strict';
import test from 'node:test';
import {driveSourceId,initialWorkerState,nextDeliveryAction,validateWorkerResult,slackText} from '../lib/worker';
const manifest={batchId:'b',jobId:'j',jobFolder:'Job-1',driveRootId:'root-folder',items:[{id:'item',sourceUrl:'https://drive.google.com/file/d/approvedsource123/view',sourceAssetId:'source',finalName:'GG_STATIC_example_1x1_v01.png',versionFolder:'v01'}]};
test('source parsing rejects SSRF, folders and external review pages before any side effect',()=>{
 assert.equal(driveSourceId(manifest.items[0].sourceUrl),'approvedsource123');
 for(const sourceUrl of ['http://127.0.0.1/a','https://drive.google.com.evil.com/file/d/approvedsource123','https://drive.google.com/drive/folders/approvedsource123','https://figma.com/design/abc','https://frame.io/review/abc'])assert.throws(()=>nextDeliveryAction('e',{...manifest,items:[{...manifest.items[0],sourceUrl}]},initialWorkerState()));
});
test('delivery advances only through verified job folder, version folder and exact asset',()=>{
 const state=initialWorkerState();assert.equal(nextDeliveryAction('e',manifest,state)?.kind,'folder');
 state.jobFolderId='job-folder';assert.equal(nextDeliveryAction('e',manifest,state)?.name,'v01');
 state.versionFolders.v01='version-folder';const action=nextDeliveryAction('e',manifest,state)!;
 assert.equal(action.kind,'copy');assert.equal(action.parentId,'version-folder');
 const result={id:'file',name:action.name,parents:['version-folder'],size:'32',mimeType:'image/png',md5Checksum:'checksum'};
 assert.doesNotThrow(()=>validateWorkerResult(action,result));
 for(const change of [{size:'0'},{name:'wrong.png'},{parents:['wrong']},{mimeType:'application/vnd.google-apps.document'},{md5Checksum:undefined}])assert.throws(()=>validateWorkerResult(action,{...result,...change}));
 state.completedItems.push('item');assert.equal(nextDeliveryAction('e',manifest,state),null);
});
test('Slack evidence must be a DM with a real timestamp and text cannot inject mentions',()=>{
 const action={id:'e:dm',kind:'slack' as const,recipient:'U123'};
 assert.throws(()=>validateWorkerResult(action,{channel:'C123',ts:'123.456'}));
 assert.doesNotThrow(()=>validateWorkerResult(action,{channel:'D123',ts:'123.456'}));
 assert.equal(slackText('<!channel> & <@U123>'),'&lt;!channel&gt; &amp; &lt;@U123&gt;');
});
