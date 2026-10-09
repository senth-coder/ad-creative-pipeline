import {NextResponse} from 'next/server';
import {stableStatuses} from '@/lib/assurance';
import {error} from '@/lib/api';
export async function GET(request:Request){if(!process.env.INTEGRATION_TOKEN||request.headers.get('authorization')!==`Bearer ${process.env.INTEGRATION_TOKEN}`)return error('Not authorized',401);return NextResponse.json({schemaVersion:1,authority:'creative-os',statuses:Object.entries(stableStatuses).map(([key,label])=>({key,label})),instructions:'Map stable keys to Notion option IDs. Display labels are not routing keys. External statuses never approve or deliver a job.'});}
