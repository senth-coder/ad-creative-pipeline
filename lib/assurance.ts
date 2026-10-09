import {z} from 'zod';
export const httpUrl=z.url().refine(v=>/^https?:\/\//i.test(v),'Use an HTTP or HTTPS link');
const optionalUrl=z.union([httpUrl,z.literal('')]);
const email=z.union([z.email(),z.literal('')]);
export const ruleSchema=z.object({id:z.string().min(1).max(80),label:z.string().trim().min(3).max(300),kind:z.enum(['required_text','forbidden_text','human']),phrase:z.string().max(500),sourceUrl:optionalUrl,active:z.boolean()}).refine(r=>!r.active||Boolean(r.sourceUrl),'Active rules need a source link').refine(r=>!r.active||r.kind==='human'||r.phrase.trim().length>0,'Text checks need an exact phrase');
export const governanceSchema=z.object({primaryQaEmail:email,backupQaEmail:email,routingConfirmed:z.boolean(),rulesConfirmed:z.boolean(),guidelinesUrl:optionalUrl,briefTemplateUrl:optionalUrl,publisher:z.string().max(100),rules:z.array(ruleSchema).max(50)}).refine(v=>!v.routingConfirmed||(Boolean(v.primaryQaEmail)&&Boolean(v.backupQaEmail)&&v.primaryQaEmail.toLowerCase()!==v.backupQaEmail.toLowerCase()),'Confirmed coverage needs distinct primary and backup reviewers').refine(v=>new Set(v.rules.map(r=>r.id)).size===v.rules.length,'Rule IDs must be unique').refine(v=>!v.rulesConfirmed||(Boolean(v.guidelinesUrl)&&v.rules.some(r=>r.active)),'Confirm a guideline source and at least one applicable check');
export type Governance=z.infer<typeof governanceSchema>;
export const emptyGovernance=():Governance=>({primaryQaEmail:'',backupQaEmail:'',routingConfirmed:false,rulesConfirmed:false,guidelinesUrl:'',briefTemplateUrl:'',publisher:'',rules:[]});
export const draftGlpRules:Governance['rules']=[
 {id:'vials',label:'Check imagery uses the permitted unbranded vials',kind:'human',phrase:'',sourceUrl:'',active:false},
 {id:'compounded',label:'Verify full compounded wording against client requirements',kind:'required_text',phrase:'compounded',sourceUrl:'',active:false},
 {id:'before-after',label:'Check that prohibited before/after imagery is absent',kind:'human',phrase:'',sourceUrl:'',active:false},
 {id:'cta',label:'Verify approved CTA wording',kind:'human',phrase:'',sourceUrl:'',active:false},
 {id:'disclaimer',label:'Verify disclaimer wording, placement and readability',kind:'human',phrase:'',sourceUrl:'',active:false},
 {id:'publisher',label:'Check applicable publisher, LegitScript and platform requirements',kind:'human',phrase:'',sourceUrl:'',active:false},
];
export type QaPerson={id:string;name:string;email:string;role:string;slackUserId?:string|null;qaUnavailable:boolean;onboarding?:string[]};
export type ClientGovernance={id:string;name:string;code:string;governance:Governance;governanceVersion:number;confirmedBy?:string|null};
export function routeQa(g:Governance,people:QaPerson[]){
 if(!g.routingConfirmed)return {person:null,reason:'QA routing awaits Senth confirmation'};
 const primary=people.find(p=>p.email.toLowerCase()===g.primaryQaEmail.toLowerCase());
 const backup=people.find(p=>p.email.toLowerCase()===g.backupQaEmail.toLowerCase());
 const eligible=(p:QaPerson|undefined)=>p&&['QA','ADMIN','STRATEGIST'].includes(p.role)&&!p.qaUnavailable&&p.slackUserId;
 if(eligible(primary))return {person:primary!,reason:'Primary reviewer'};
 if(eligible(backup))return {person:backup!,reason:'Backup reviewer'};
 return {person:null,reason:'Primary and backup are unavailable or missing Slack IDs'};
}
export const namingSchema=z.object({scope:z.string().regex(/^[A-Z0-9-]{2,24}$/,'Scope: uppercase letters, numbers or hyphens'),type:z.string().regex(/^[A-Z][A-Z0-9-]{1,24}$/),descriptor:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Descriptor: lowercase words separated by hyphens').max(100),aspect:z.string().regex(/^[1-9][0-9]*x[1-9][0-9]*$/,'Aspect: use 9x16, 1x1, 4x5, etc.'),version:z.number().int().min(1).max(9999),extension:z.enum(['mp4','mov','png','jpg','jpeg','webp','gif','pdf'])});
export type AssetNaming=z.infer<typeof namingSchema>;
export function deliveryFilename(input:AssetNaming){const i=namingSchema.parse(input);return `${i.scope}_${i.type}_${i.descriptor}_${i.aspect}_v${String(i.version).padStart(2,'0')}.${i.extension}`;}
export function namingProblem(filename:string,input:AssetNaming){try{return filename===deliveryFilename(input)?null:'Filename does not match the current delivery convention'}catch{return 'Invalid naming fields'}}
export const assetSchema=z.object({variantCode:z.string().regex(/^[A-Z]$/),version:z.number().int().positive(),briefRevision:z.number().int().positive(),sourceBriefUrl:httpUrl,sourceUrl:httpUrl,externalAssetId:z.string().trim().min(1).max(200),naming:namingSchema,copyText:z.string().max(20000),revisionNote:z.string().trim().min(3).max(1500)}).refine(v=>v.version===v.naming.version,'Asset and filename versions must match');
export type AssetInput=z.infer<typeof assetSchema>;
export const reviewSchema=z.object({assetId:z.string().min(1),humanChecks:z.array(z.string()).max(60),evidenceUrl:httpUrl,copyVerified:z.boolean(),note:z.string().max(1500)});
export type AssetReview={policyVersion:number;reviewedAt:string;reviewer:string;humanChecks:string[];evidenceUrl:string;copyVerified:boolean;note:string;passed:boolean};
export type TrackedAsset=AssetInput&{id:string;filename:string;review:AssetReview|null;createdAt:string};
export type Finding={id:string;label:string;result:'pass'|'fail'|'human_required'};
export function assessAsset(asset:AssetInput,governance:Governance,humanChecks:string[],copyVerified:boolean):Finding[]{
 const text=asset.copyText.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
 const findings:Finding[]=[{id:'rules-confirmed',label:'Client rules reviewed and confirmed',result:governance.rulesConfirmed?'pass':'fail'},{id:'copy-verified',label:'Human verified transcript against final visual/audio',result:copyVerified?'pass':'human_required'}];
 for(const rule of governance.rules.filter(r=>r.active)){
 const phrase=rule.phrase.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
 const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const contains=new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,'u').test(text);
 findings.push({id:rule.id,label:rule.label,result:rule.kind==='human'?(humanChecks.includes(rule.id)?'pass':'human_required'):rule.kind==='required_text'?(contains?'pass':'fail'):(contains?'fail':'pass')});
 }
 return findings;
}
export function releaseProblem(variants:string[],assets:TrackedAsset[],governance:Governance,version:number){
 if(!governance.rulesConfirmed)return 'Confirm the client rule set before approval or launch';
 for(const code of variants){const asset=assets.filter(a=>a.variantCode===code).sort((a,b)=>b.version-a.version)[0];if(!asset)return `Register the current asset for variant ${code}`;
 if(!asset.review?.passed||asset.review.policyVersion!==version)return `Variant ${code} needs QA against the current client rules`;
 if(namingProblem(asset.filename,asset.naming))return `Variant ${code} filename needs correction`;
 }
 return null;
}
export const metricSchema=z.object({assetId:z.string().min(1),externalId:z.string().min(1).max(200),provider:z.enum(['manual','motion','runneth']),account:z.string().trim().min(1).max(100),adId:z.string().trim().min(1).max(200),sourceUrl:httpUrl,periodStart:z.iso.date(),periodEnd:z.iso.date(),currency:z.string().regex(/^[A-Z]{3}$/),spend:z.number().nonnegative().nullable(),impressions:z.number().int().nonnegative().nullable(),clicks:z.number().int().nonnegative().nullable(),conversions:z.number().nonnegative().nullable(),revenue:z.number().nonnegative().nullable(),conversionDefinition:z.string().trim().min(3).max(200),learning:z.string().max(2000)}).refine(v=>v.periodStart<=v.periodEnd,'Reporting dates must be ordered');
export type Metric=z.infer<typeof metricSchema>&{id?:string};
export function metricRates(m:Metric){return {ctr:m.impressions&&m.clicks!==null?100*m.clicks/m.impressions:null,cpa:m.conversions&&m.spend!==null?m.spend/m.conversions:null,roas:m.spend&&m.revenue!==null?m.revenue/m.spend:null};}
export const onboardingSteps=['Workspace account and role verified','Board and client access verified','Slack membership and DM mapping verified','Notification test received','Client rules and naming reviewed','Test brief, revision and delivery completed'] as const;
export const gapDefinitions=[['qa-coverage','QA workload and backup coverage'],['compliance','Client compliance and visual QA'],['ai-qa','AI QA scope and production readiness'],['client-rules','Central client and publisher rules'],['traceability','Brief-to-asset and revision traceability'],['naming','Naming and version enforcement'],['performance','Asset-level performance and learning'],['status-sync','Stable status mappings and notification retries'],['onboarding','Team onboarding checklist'],['structured-intake','Structured client guidelines and intake'],['analytics','Motion / Runneth feedback into briefs']] as const;
export const gapSchema=z.object({key:z.enum(gapDefinitions.map(g=>g[0]) as [string,...string[]]),status:z.enum(['Reported','Confirmed','Covered','Not applicable']),owner:z.string().max(100),evidenceUrl:optionalUrl,notes:z.string().max(2000)}).refine(v=>v.status==='Reported'||Boolean(v.evidenceUrl),'A validated assessment needs an evidence link');
export type Gap=z.infer<typeof gapSchema>;
export const stableStatuses={BRIEFED:'Briefed',IN_PRODUCTION:'In Production',INTERNAL_REVIEW:'Internal Review',CLIENT_REVIEW:'Client Review',APPROVED:'Approved',DELIVERED:'Delivered'} as const;
