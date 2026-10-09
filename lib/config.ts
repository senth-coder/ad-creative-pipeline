import { z } from 'zod';
export const fieldSchema=z.object({key:z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/),label:z.string().min(1).max(100),placeholder:z.string().max(200),required:z.boolean().optional()});
export const templateSchema=z.object({type:z.enum(['Video','Static','Carousel','Motion','UGC']),fields:z.array(fieldSchema).min(1).max(30)});
export const ruleSchema=z.object({letters:z.array(z.string().regex(/^[A-Z]$/)).min(1).max(26).refine(a=>new Set(a).size===a.length)});
