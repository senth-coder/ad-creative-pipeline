import {createHash,randomBytes} from 'node:crypto';
import {db} from './db';
import {openMotion,sealMotion} from './motion-crypto';
export const MOTION_ENDPOINT='https://projects.motionapp.com/mcp';
export const MOTION_ISSUER='https://projects.motionapp.com/api/auth';
export const APP_ORIGIN='https://ad-creative-pipeline-nine.vercel.app';
export const CALLBACK=APP_ORIGIN+'/api/integrations/motion/callback';
const CONNECTION='integration:motion:connection';
const REGISTRATION='integration:motion:registration';
const SCOPES='openid profile email offline_access documents:read runneth:read runneth:mcp';
type Registration={client_id:string};
type Tokens={access_token:string;refresh_token?:string;expires_at:number;client_id:string;scope:string;connectedAt:string;connectedBy:string};
type Attempt={actorId:string;verifier:string;clientId:string;expires:number};
type Tool={name:string;description?:string;inputSchema?:unknown;annotations?:{readOnlyHint?:boolean}};
async function jsonRequest(url:string,body:unknown,form=false){const r=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'},body:form?String(body):JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Motion authorization request failed (${r.status})`);return r.json();}
// Reuse the private event store with a distinct provider; intake endpoints only select intake providers.
// Every payload here is authenticated encryption, never a plaintext credential or browser response.
async function save(id:string,value:unknown){const payload={sealed:sealMotion(value,id)};await db.inboundEvent.upsert({where:{externalId:id},create:{provider:'motion_connection',externalId:id,payload,processedAt:new Date()},update:{payload}});}
async function read<T>(id:string):Promise<T|null>{const r=await db.inboundEvent.findUnique({where:{externalId:id}});const payload=r?.payload as {sealed?:string}|null;return payload?.sealed?openMotion<T>(payload.sealed,id):null;}
export async function beginMotion(actorId:string){
 let registration=await read<Registration>(REGISTRATION);
 if(!registration){const r=await jsonRequest(MOTION_ISSUER+'/oauth2/register',{client_name:'Ghost Growth Creative OS',redirect_uris:[CALLBACK],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope:SCOPES});if(typeof r.client_id!=='string')throw new Error('Motion did not return a client registration');registration={client_id:r.client_id};await save(REGISTRATION,registration);}
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const id='motion:oauth:'+createHash('sha256').update(state).digest('hex');
 await db.inboundEvent.create({data:{provider:'motion_oauth',externalId:id,payload:{sealed:sealMotion({actorId,verifier,clientId:registration.client_id,expires:Date.now()+600000},id)}}});
 const url=new URL(MOTION_ISSUER+'/oauth2/authorize');for(const [k,v] of Object.entries({client_id:registration.client_id,redirect_uri:CALLBACK,response_type:'code',scope:SCOPES,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',resource:MOTION_ENDPOINT}))url.searchParams.set(k,v);
 return {state,url:url.toString()};
}
export async function finishMotion(state:string,code:string,actorId:string){
 const id='motion:oauth:'+createHash('sha256').update(state).digest('hex');
 const attempt=await read<Attempt>(id);if(!attempt||attempt.actorId!==actorId||attempt.expires<Date.now())throw new Error('Expired or invalid connection request');
 const claimed=await db.inboundEvent.updateMany({where:{externalId:id,processedAt:null},data:{processedAt:new Date()}});if(claimed.count!==1)throw new Error('Connection request already used');
 const t=await jsonRequest(MOTION_ISSUER+'/oauth2/token',new URLSearchParams({grant_type:'authorization_code',code,client_id:attempt.clientId,redirect_uri:CALLBACK,code_verifier:attempt.verifier,resource:MOTION_ENDPOINT}),true);
 if(typeof t.access_token!=='string'||t.token_type?.toLowerCase()!=='bearer')throw new Error('Invalid Motion token response');
 await save(CONNECTION,{access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+Number(t.expires_in||3600)*1000,scope:t.scope||SCOPES,client_id:attempt.clientId,connectedAt:new Date().toISOString(),connectedBy:actorId});
 await db.auditEvent.create({data:{actorId,action:'motion.connected',after:{endpoint:MOTION_ENDPOINT}}});
}
async function token(){
 // Serialize refreshes across server instances so rotating refresh tokens cannot race.
 return db.$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(72831092)`;const r=await tx.inboundEvent.findUnique({where:{externalId:CONNECTION}});const payload=r?.payload as {sealed?:string}|null;if(!payload?.sealed)throw new Error('Connect Motion first');let t=openMotion<Tokens>(payload.sealed,CONNECTION);
  if(t.expires_at<Date.now()+60000){if(!t.refresh_token)throw new Error('Reconnect Motion to renew access');const next=await jsonRequest(MOTION_ISSUER+'/oauth2/token',new URLSearchParams({grant_type:'refresh_token',refresh_token:t.refresh_token,client_id:t.client_id,resource:MOTION_ENDPOINT}),true);if(typeof next.access_token!=='string')throw new Error('Reconnect Motion to renew access');t={...t,access_token:next.access_token,refresh_token:next.refresh_token||t.refresh_token,expires_at:Date.now()+Number(next.expires_in||3600)*1000};await tx.inboundEvent.update({where:{externalId:CONNECTION},data:{payload:{sealed:sealMotion(t,CONNECTION)}}});}return t.access_token;
 },{timeout:30000,maxWait:5000});
}
export function parseMcp(text:string,id:number){let messages:Record<string,unknown>[]=[];try{messages=[JSON.parse(text)];}catch{messages=text.split(/\r?\n\r?\n/).flatMap(block=>{const s=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');try{return s?[JSON.parse(s)]:[];}catch{return [];}});}const m=messages.find(m=>m.id===id);if(!m||m.error||!m.result)throw new Error('Motion returned an invalid MCP response');return m.result as Record<string,unknown>;}
export async function testMotion(){
 const access=await token();let session='';let protocol='2025-03-26';
 async function rpc(method:string,params:unknown,id?:number){const headers:Record<string,string>={'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:`Bearer ${access}`};if(session)headers['Mcp-Session-Id']=session;headers['MCP-Protocol-Version']=protocol;
  const r=await fetch(MOTION_ENDPOINT,{method:'POST',redirect:'error',headers,body:JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,params}),cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Motion connection test failed (${r.status}). Reconnect if access has expired.`);session=r.headers.get('mcp-session-id')||session;if(id===undefined){await r.body?.cancel();return {};}const body=await r.text();if(body.length>2000000)throw new Error('Motion response is too large');return parseMcp(body,id);
 }
 const init=await rpc('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'Ghost Growth Creative OS',version:'1.0.0'}},1);if(typeof init.protocolVersion==='string')protocol=init.protocolVersion;await rpc('notifications/initialized',{});
 const tools:Tool[]=[];let cursor:string|undefined;let complete=false;
 for(let page=0;page<20;page++){const result=await rpc('tools/list',cursor?{cursor}:{},page+2);if(!Array.isArray(result.tools))throw new Error('Motion did not return a tool list');tools.push(...result.tools as Tool[]);cursor=typeof result.nextCursor==='string'?result.nextCursor:undefined;if(!cursor){complete=true;break;}}
 if(!complete)throw new Error('Motion tool listing exceeded the page limit');
 const checkedAt=new Date().toISOString();await save('integration:motion:capabilities',{checkedAt,tools});return {checkedAt,tools};
}
export async function motionStatus(){const t=await read<Tokens>(CONNECTION);const c=await read<{checkedAt:string;tools:Tool[]}>('integration:motion:capabilities');return {connected:Boolean(t),endpoint:MOTION_ENDPOINT,connectedAt:t?.connectedAt,scope:t?.scope,checkedAt:c?.checkedAt,tools:c?.tools||[],syncActive:false};}
export async function disconnectMotion(actorId:string){await db.inboundEvent.deleteMany({where:{externalId:{in:[CONNECTION,'integration:motion:capabilities']}}});await db.auditEvent.create({data:{actorId,action:'motion.disconnected'}});}
