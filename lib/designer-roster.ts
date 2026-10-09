// Notion Ad Creative Pipeline → Designer options, verified 2026-10-09.
// Labels are distinct from login identities; never invent an account from a label.
export const designerRoster=['Preston','Illia','Marc','Dasha','Ahmed','Kyle','Danylo','Xyrus'] as const;
const aliases:Record<string,string[]>={Preston:['Preston','Preston Yarger'],Illia:['Illia'],Marc:['Marc','Marc Padlan'],Dasha:['Dasha'],Ahmed:['Ahmed'],Kyle:['Kyle'],Danylo:['Danylo','Danylo Vilkhovyi'],Xyrus:['Xyrus','Xyrus Afable']};
export function designerOptions(makers:string[]){return designerRoster.map(label=>{const matches=makers.filter(name=>aliases[label].some(alias=>alias.toLowerCase()===name.toLowerCase()));return {label,value:matches.length===1?matches[0]:'',available:matches.length===1};});}
