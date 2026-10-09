import {z} from 'zod';
import type {Job} from './workflow';
import {localDate} from './workspace-date';

export const cadenceLabels={weekly:'Weekly',biweekly:'Every two weeks',monthly:'Monthly'} as const;
export const formatScheduleSchema=z.object({enabled:z.boolean(),cadence:z.enum(['weekly','biweekly','monthly']),start:z.iso.date(),target:z.number().int().min(1).max(10000)});
export const deliveryScheduleSchema=z.object({statics:formatScheduleSchema,videos:formatScheduleSchema});
export type FormatSchedule=z.infer<typeof formatScheduleSchema>;
export type DeliverySchedule=z.infer<typeof deliveryScheduleSchema>;
export const defaultSchedule=(start=localDate()):DeliverySchedule=>({statics:{enabled:false,cadence:'weekly',start,target:1},videos:{enabled:false,cadence:'biweekly',start,target:1}});
export function readSchedule(value:unknown){const parsed=deliveryScheduleSchema.safeParse(value);return parsed.success?parsed.data:null;}
function monthAt(anchor:string,offset:number){const d=new Date(anchor+'T00:00:00Z');const first=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1));const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d.getUTCDate(),last))).toISOString().slice(0,10);}
export function cadenceWindow(schedule:FormatSchedule,today:string){
 let from=schedule.start,until:string;
 if(schedule.cadence==='monthly'){
  const a=new Date(schedule.start+'T00:00:00Z'),t=new Date(today+'T00:00:00Z');let n=Math.max(0,(t.getUTCFullYear()-a.getUTCFullYear())*12+t.getUTCMonth()-a.getUTCMonth());
  if(n>0&&monthAt(schedule.start,n)>today)n--;
  from=monthAt(schedule.start,n);until=monthAt(schedule.start,n+1);
 }else{const days=schedule.cadence==='weekly'?7:14,ms=86400000;const n=Math.max(0,Math.floor((Date.parse(today)-Date.parse(schedule.start))/(days*ms)));from=new Date(Date.parse(schedule.start)+n*days*ms).toISOString().slice(0,10);until=new Date(Date.parse(from)+days*ms).toISOString().slice(0,10);}
 const through=new Date(Date.parse(until)-86400000).toISOString().slice(0,10);
 return {from,until,through,upcoming:today<from};
}
export function cadenceProgress(jobs:Job[],client:string,format:'statics'|'videos',schedule:FormatSchedule,today:string){
 const window=cadenceWindow(schedule,today),types=format==='statics'?['Static','Carousel']:['Video','Motion','UGC'];
 const matching=jobs.filter(j=>j.client===client&&types.includes(j.type));
 const delivered=matching.filter(j=>j.status==='Delivered'&&j.deliveredAt&&localDate(new Date(j.deliveredAt))>=window.from&&localDate(new Date(j.deliveredAt))<window.until).reduce((n,j)=>n+j.variants.length,0);
 const planned=matching.filter(j=>j.status!=='Delivered'&&j.due>=window.from&&j.due<window.until).reduce((n,j)=>n+j.variants.length,0);
 return {...window,delivered,planned,remaining:Math.max(0,schedule.target-delivered),unplanned:Math.max(0,schedule.target-delivered-planned)};
}
