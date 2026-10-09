import {timingSafeEqual} from 'node:crypto';
export function integrationAuthorized(request:Request){
 const secret=process.env.INTEGRATION_TOKEN;if(!secret)return false;
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(request.headers.get('authorization')||'');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
