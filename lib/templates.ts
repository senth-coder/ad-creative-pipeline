import type { CreativeType } from '@/lib/workflow';
export type BriefField={key:string;label:string;placeholder:string;required?:boolean};
export const sharedFields:BriefField[]=[
 {key:'objective',label:'Objective',placeholder:'What should this creative achieve?',required:true},
 {key:'audience',label:'Audience',placeholder:'Who should this speak to?',required:true},
 {key:'offer',label:'Offer or product',placeholder:'What are we promoting?',required:true},
 {key:'hook',label:'Opening hook',placeholder:'First message or visual idea'},
 {key:'cta',label:'Call to action',placeholder:'What should the viewer do?'},
 {key:'references',label:'Brand and source references',placeholder:'Links to source assets or brand guidance'}
];
export const typeFields:Record<CreativeType,BriefField[]>={
 UGC:[{key:'creator',label:'Creator / talent',placeholder:'Creator name or casting direction'},{key:'script',label:'Script / talking points',placeholder:'Hook, demonstration, proof and CTA'},{key:'duration',label:'Target duration',placeholder:'e.g. 30 seconds'},{key:'aspectRatio',label:'Aspect ratio',placeholder:'e.g. 9:16'}],
 Video:[{key:'duration',label:'Target duration',placeholder:'e.g. 15 seconds',required:true},{key:'aspectRatio',label:'Aspect ratio',placeholder:'e.g. 9:16',required:true},{key:'platform',label:'Placement',placeholder:'e.g. Meta Reels'}],
 Static:[{key:'dimensions',label:'Dimensions',placeholder:'e.g. 1080 × 1080',required:true},{key:'copyLimit',label:'Copy limit',placeholder:'e.g. 30 words'}],
 Carousel:[{key:'cardCount',label:'Number of cards',placeholder:'e.g. 5',required:true},{key:'dimensions',label:'Dimensions',placeholder:'e.g. 1080 × 1080'}],
 Motion:[{key:'duration',label:'Target duration',placeholder:'e.g. 6 seconds',required:true},{key:'aspectRatio',label:'Aspect ratio',placeholder:'e.g. 9:16',required:true},{key:'animationNotes',label:'Animation direction',placeholder:'Describe motion and pacing'}]
};
export function requiredBriefProblem(fields:BriefField[],brief:Record<string,string>={}){const missing=fields.filter(f=>f.required&&!brief[f.key]?.trim());return missing.length?'Complete required brief fields: '+missing.map(f=>f.label).join(', '):null;}
