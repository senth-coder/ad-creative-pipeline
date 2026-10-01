import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser, mayCreate } from '@/lib/permissions';
import { error } from '@/lib/api';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);if(!mayCreate(user))return error('Not permitted',403);const events=await db.inboundEvent.findMany({where:{provider:'motion',processedAt:null},orderBy:{receivedAt:'desc'},take:100});return NextResponse.json({events});}
