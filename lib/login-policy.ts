export function workspaceLogin(email:string|null|undefined,verified:unknown,configuredDomains=''){
 const normalized=email?.trim().toLowerCase()||'';
 const parts=normalized.split('@');
 if(verified!==true||parts.length!==2||!parts[0])return null;
 const domain=parts[1];
 const allowed=new Set(['ghostgrowth.io',...configuredDomains.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)]);
 if(!allowed.has(domain))return null;
 return {email:normalized,autoEnroll:domain==='ghostgrowth.io'};
}
