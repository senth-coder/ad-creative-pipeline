import {z} from 'zod';
export const deliveryReceiptSchema=z.discriminatedUnion('type',[
 z.object({id:z.string().min(1).max(200),type:z.literal('drive.item_verified'),itemId:z.string().min(1),driveFileId:z.string().min(1),finalName:z.string().min(1),bytes:z.number().int().positive(),checksum:z.string().min(1).optional(),driveFolderId:z.string().min(1)}),
 z.object({id:z.string().min(1).max(200),type:z.literal('slack.dm_confirmed'),receiptId:z.string().min(1),recipientSlackId:z.string().min(1)}),
 z.object({id:z.string().min(1).max(200),type:z.literal('delivery.failed'),message:z.string().trim().min(1).max(1000)})
]);
export type DeliveryReceipt=z.infer<typeof deliveryReceiptSchema>;
export type ReceiptItem={id:string;finalName:string;driveFileId:string|null;status:string;checksum?:string|null};
export function receiptProblem(event:DeliveryReceipt,batch:{items:ReceiptItem[];driveFolderId:string|null;mediaBuyerSlackId:string|null}):string|null{
 if(event.type==='delivery.failed')return null;
 if(event.type==='drive.item_verified'){
  const item=batch.items.find(i=>i.id===event.itemId);
  if(!item)return 'Item not in batch';
  if(item.finalName!==event.finalName)return 'Uploaded filename does not match the manifest';
  if(item.driveFileId&&item.driveFileId!==event.driveFileId)return 'This item already has a different verified Drive file';
  if(item.checksum&&event.checksum!==item.checksum)return 'Verified file checksum changed';
  if(batch.items.some(i=>i.id!==item.id&&i.driveFileId===event.driveFileId))return 'Each variant must have its own Drive file';
  if(batch.driveFolderId&&batch.driveFolderId!==event.driveFolderId)return 'Drive job folder mismatch';
 }else{
  if(!batch.mediaBuyerSlackId||batch.mediaBuyerSlackId!==event.recipientSlackId)return 'Slack receipt is for the wrong media buyer';
  if(!driveReady(batch))return 'Verify every Drive asset before confirming the Slack handoff';
 }
 return null;
}
export function driveReady(batch:{items:ReceiptItem[];driveFolderId:string|null}){return Boolean(batch.driveFolderId)&&batch.items.length>0&&batch.items.every(i=>i.driveFileId&&i.status==='DRIVE_VERIFIED');}
export function receiptKey(batchId:string,eventId:string){return `delivery:${batchId}:${eventId}`;}
