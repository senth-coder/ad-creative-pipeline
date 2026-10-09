import {NextResponse} from 'next/server';
import {currentUser,mayCreate} from '@/lib/permissions';
import {error} from '@/lib/api';
import {wakeWorker} from '@/lib/worker-wake';
export async function POST(){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);
 if(!process.env.MAKE_WORKER_WAKE_URL)return error('Automatic worker connection is not configured',409);
 wakeWorker();return NextResponse.json({queued:true});
}
