import { NextResponse } from 'next/server';
export function error(message:string,status=400) { return NextResponse.json({error:message},{status}); }
export function jsonBody(request:Request) { return request.json().catch(()=>null); }
