import {after} from 'next/server';
import {db} from './db';

// The hook carries no job, client, recipient or authentication payload. Make
// independently claims committed work using its private integration token.
export function wakeWorker(){
 const address=process.env.MAKE_WORKER_WAKE_URL;if(!address)return;
 after(async()=>{
  try{
   const url=new URL(address);
   if(url.protocol!=='https:'||!/^hook\.(?:us|eu)\d+\.make\.com$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash)throw new Error('Invalid wake-up configuration');
   const pending=await db.outboxEvent.findFirst({where:{deliveredAt:null,attempts:{lt:10},AND:[{OR:[{lastError:null},{lastError:{not:{startsWith:'WORKER_PENDING:'}}}]}],OR:[{leasedUntil:null},{leasedUntil:{lt:new Date()}}]},select:{id:true}});
   if(!pending)return;
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"wake":true}',redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error('Wake-up was rejected');
   await db.auditEvent.create({data:{action:'worker.wake.accepted',after:{eventId:pending.id}}});
  }catch{
   // Never log the secret hook address, response body or raw network exception.
   await db.auditEvent.create({data:{action:'worker.wake.failed',reason:'Automatic processing could not be started. Check Make, then use Start pending work in Settings.'}}).catch(()=>{});
  }
 });
}
