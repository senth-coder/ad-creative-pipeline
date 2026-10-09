import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {error} from '@/lib/api';
import {verifySignature} from '@/lib/signature';
import {deliveryReceiptSchema} from '@/lib/delivery';
import {recordDeliveryReceipt} from '@/lib/receipt-server';
export async function POST(request:Request,{params}:{params:Promise<{batchId:string}>}){
 const body=await request.text();if(!verifySignature(body,request.headers.get('x-integration-signature'),process.env.MAKE_WEBHOOK_SECRET))return error('Invalid signature',401);
 let json:unknown;try{json=JSON.parse(body)}catch{return error('Invalid JSON')};const parsed=deliveryReceiptSchema.safeParse(json);if(!parsed.success)return error('Invalid receipt: filename, positive file size and intended Slack recipient are required');
 const {batchId}=await params;
 try{return NextResponse.json(await db.$transaction(tx=>recordDeliveryReceipt(tx,batchId,parsed.data)));}catch(e){return error((e as Error).message,409)}
}
