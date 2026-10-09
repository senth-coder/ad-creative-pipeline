import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayView} from '@/lib/permissions';
import {error} from '@/lib/api';
export async function GET(_request:Request,{params}:{params:Promise<{batchId:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);const {batchId}=await params;
 const batch=await db.deliveryBatch.findUnique({where:{id:batchId},include:{job:true,items:true}});if(!batch)return error('Batch not found',404);if(!await mayView(user,batch.job))return error('Not permitted',403);
 return NextResponse.json({batch:{id:batch.id,status:batch.status,error:batch.error,driveFolderId:batch.driveFolderId,slackReceiptId:batch.slackReceiptId,items:batch.items.map(i=>({id:i.id,finalName:i.finalName,status:i.status,driveFileId:i.driveFileId}))}});
}
