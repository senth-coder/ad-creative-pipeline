import type {Prisma} from '@prisma/client';
export async function lockClient(tx:Prisma.TransactionClient,id:string){await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${id} FOR UPDATE`;}
