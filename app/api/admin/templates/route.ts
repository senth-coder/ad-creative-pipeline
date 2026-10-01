import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/permissions';
import { error, jsonBody } from '@/lib/api';
import { ruleSchema, templateSchema } from '@/lib/config';

const updateSchema=templateSchema.extend({rule:ruleSchema});
export async function GET(){const user=await currentUser();if(!user)return error('Sign in required',401);const templates=await db.briefTemplate.findMany({where:{active:true},orderBy:{version:'desc'}});const rules=await db.variantRule.findMany({where:{active:true},orderBy:{version:'desc'}});return NextResponse.json({templates,rules});}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return error('Sign in required',401);if(user.role!=='ADMIN')return error('Not permitted',403);
 const parsed=updateSchema.safeParse(await jsonBody(request));if(!parsed.success)return error('Invalid template or variant rule');const {type,fields,rule}=parsed.data;
 const result=await db.$transaction(async tx=>{
  const [lastTemplate,lastRule]=await Promise.all([tx.briefTemplate.findFirst({where:{type},orderBy:{version:'desc'}}),tx.variantRule.findFirst({where:{type},orderBy:{version:'desc'}})]);
  await tx.briefTemplate.updateMany({where:{type,active:true},data:{active:false}});await tx.variantRule.updateMany({where:{type,active:true},data:{active:false}});
  const template=await tx.briefTemplate.create({data:{type,version:(lastTemplate?.version||0)+1,fields}});
  const variantRule=await tx.variantRule.create({data:{type,version:(lastRule?.version||0)+1,rule}});
  return {template,variantRule};
 });
 return NextResponse.json(result,{status:201});
}
