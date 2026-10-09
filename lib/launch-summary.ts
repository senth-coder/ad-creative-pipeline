export function launchSummary(variants:string[],records:{variantCode:string;status:string}[]){
 const live=new Set(records.filter(r=>r.status==='Live'&&variants.includes(r.variantCode)).map(r=>r.variantCode));
 const launchState=variants.length>0&&live.size===variants.length?'Launched':live.size>0?'Partially launched':records.some(r=>r.status==='Paused')?'Paused':'Awaiting launch';
 return {launchState,launchedVariants:live.size} as {launchState:'Launched'|'Partially launched'|'Paused'|'Awaiting launch';launchedVariants:number};
}
