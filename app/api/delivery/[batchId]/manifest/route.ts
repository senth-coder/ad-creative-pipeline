import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
import {queueDelivery} from '@/lib/delivery-server';
export async function POST(_request:Request,{params}:{params:Promise<{batchId:string}>}){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 const {batchId}=await params;
 try{return NextResponse.json(await db.$transaction(tx=>queueDelivery(tx,batchId,user.id)),{status:201});}catch(e){return error((e as Error).message,409)}
}
