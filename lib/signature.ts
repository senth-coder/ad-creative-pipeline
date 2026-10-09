import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifySignature(body:string,signature:string|null,secret:string|undefined) {
 if(!secret||!signature)return false;
 const digest=createHmac('sha256',secret).update(body).digest('hex');
 const supplied=signature.replace(/^sha256=/,'');
 if(!/^[a-fA-F0-9]{64}$/.test(supplied))return false;
 const a=Buffer.from(digest,'hex'),b=Buffer.from(supplied,'hex');
 return a.length===b.length&&timingSafeEqual(a,b);
}
