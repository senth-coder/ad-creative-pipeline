import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/permissions';
import { error } from '@/lib/api';
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);return NextResponse.json({user:{name:user.name,email:user.email,role:user.role}})}
