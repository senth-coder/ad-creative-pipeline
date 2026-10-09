export const briefFormats=['UGC','Static','Video'] as const;
export type BriefFormat=typeof briefFormats[number];
const roster:Record<string,string[]>={
 RexMD:['Luke'],LifeMD:['Luke'],Enhanced:['Luke'],Maximus:['Luke','Simon Harris'],Carebox:['Mattan'],
 Embody:['Simon Harris'],OpenRx:['Simon Harris'],Effecty:['Simon Harris'],Wellmedr:['Simon Harris'],'Science Co':['Simon Harris'],Nucific:['Simon Harris'],Mondae:['Simon Harris'],Sunlight:['Simon Harris'],TryDose:['Simon Harris'],'Affordable Wellness':['Simon Harris'],Collective:['Simon Harris'],Valeon:['Simon Harris'],'Total RX':['Simon Harris'],'Aura Meds':['Simon Harris','Jam'],LivBetr:['Simon Harris'],
 ReadyRX:['Jam'],TMates:['Jam'],Navora:['Jam'],Everlife:['Jam'],AskRX:['Jam']
};
export const activeQaClients=Object.keys(roster);
const normalize=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function canonicalQaClient(name:string){return activeQaClients.find(c=>normalize(c)===normalize(name));}
export function reviewerNames(client:string,format:string):string[]{const c=canonicalQaClient(client);if(!c||!briefFormats.includes(format as BriefFormat))return [];return c==='Science Co'&&format==='UGC'?['Mattan']:roster[c];}
export type QaChoice={id:string;name:string;email:string;slackUserId?:string|null;qaUnavailable:boolean;role:string};
export function qaChoices(client:string,format:string,people:QaChoice[]){return reviewerNames(client,format).map(name=>{const matches=people.filter(p=>p.name===name&&['QA','ADMIN','STRATEGIST'].includes(p.role));return matches.length===1?matches[0]:null;}).filter((p):p is QaChoice=>p!==null);}
export function chooseQa(client:string,format:string,people:QaChoice[],selected?:string){const names=reviewerNames(client,format);const choices=qaChoices(client,format,people);if(!names.length)throw new Error('This client and format need a QA route configured first.');if(choices.length!==names.length)throw new Error('A mapped reviewer is missing or ambiguous. Ask an administrator to check the QA roster.');const person=selected?choices.find(p=>p.id===selected):choices.length===1?choices[0]:undefined;if(!person)throw new Error('Choose the responsible QA reviewer for this brief.');return person;}
export function assignedQaId(brief:unknown){const b=brief as Record<string,unknown>|null;return typeof b?.qaReviewerId==='string'?b.qaReviewerId:null;}
