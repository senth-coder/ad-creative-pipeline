import {z} from 'zod';

export const workerTypes=['delivery.ready','delivery.drive_verified','job.created','job.assigned','review.internal.ready','review.client.ready','review.changes_required','job.blocked','job.transition','job.approved','job.delivered'] as const;
export type WorkerAction={id:string;kind:'folder'|'copy'|'slack';name?:string;parentId?:string;sourceId?:string;recipient?:string;text?:string;itemId?:string;versionFolder?:string};
export type WorkerState={jobFolderId?:string;versionFolders:Record<string,string>;completedItems:string[];pending?:WorkerAction};
export type ManifestItem={id:string;sourceUrl:string;sourceAssetId:string;finalName:string;versionFolder:string};
export type Manifest={batchId:string;jobId:string;jobFolder:string;driveRootId:string;items:ManifestItem[]};
export const initialWorkerState=():WorkerState=>({versionFolders:{},completedItems:[]});
export function driveSourceId(value:string){
 let url:URL;try{url=new URL(value)}catch{throw new Error('Use an accessible Google Drive final-export link');}
 if(url.protocol!=='https:'||url.hostname!=='drive.google.com'||url.username||url.password)throw new Error('Automatic delivery currently requires a Google Drive final export. Keep the Figma/Frame.io review link and register the exported file.');
 const id=url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1]||(url.pathname==='/open'?url.searchParams.get('id'):null);
 if(!id||!/^[a-zA-Z0-9_-]{10,}$/.test(id))throw new Error('Use the individual Drive file link, not a folder or review page');return id;
}
export function nextDeliveryAction(eventId:string,m:Manifest,s:WorkerState):WorkerAction|null{
 if(!m.driveRootId||!m.items.length)throw new Error('Delivery manifest needs a destination and at least one asset');
 // Validate every source before creating folders or copying any file.
 const sources=m.items.map(i=>driveSourceId(i.sourceUrl));
 if(!s.jobFolderId)return {id:`${eventId}:job-folder`,kind:'folder',name:m.jobFolder,parentId:m.driveRootId};
 for(let n=0;n<m.items.length;n++){
  const i=m.items[n];if(s.completedItems.includes(i.id))continue;
  const folder=s.versionFolders[i.versionFolder];
  if(!folder)return {id:`${eventId}:folder:${i.versionFolder}`,kind:'folder',name:i.versionFolder,parentId:s.jobFolderId,versionFolder:i.versionFolder};
  return {id:`${eventId}:copy:${i.id}`,kind:'copy',sourceId:sources[n],name:i.finalName,parentId:folder,itemId:i.id};
 }
 return null;
}
export const workerResultSchema=z.object({eventId:z.string().min(1),leaseToken:z.string().uuid(),actionId:z.string().min(1),result:z.object({id:z.string().optional(),name:z.string().optional(),mimeType:z.string().optional(),size:z.union([z.string(),z.number()]).optional(),parents:z.array(z.string()).optional(),md5Checksum:z.string().optional(),channel:z.string().optional(),ts:z.string().optional()}),error:z.string().max(1000).optional()});
export type WorkerResult=z.infer<typeof workerResultSchema>['result'];
export function validateWorkerResult(a:WorkerAction,r:WorkerResult){
 if(a.kind==='slack'){
  if(!/^D[A-Z0-9]+$/.test(r.channel||'')||!/^\d+\.\d+$/.test(r.ts||''))throw new Error('Expected a Slack DM channel and message timestamp');return;
 }
 if(!/^[a-zA-Z0-9_-]+$/.test(r.id||'')||r.name!==a.name||!r.parents?.includes(a.parentId!))throw new Error('Drive result does not match the requested name and parent folder');
 if(a.kind==='folder'&&r.mimeType!=='application/vnd.google-apps.folder')throw new Error('Drive result is not a folder');
 if(a.kind==='copy'&&(!Number.isSafeInteger(Number(r.size))||Number(r.size)<=0||!r.md5Checksum||r.mimeType?.startsWith('application/vnd.google-apps.')))throw new Error('Verify a nonempty binary export and its Drive checksum');
}
export function slackText(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
