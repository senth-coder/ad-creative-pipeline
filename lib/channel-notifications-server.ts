import type {Prisma} from '@prisma/client';
import {channelNotices,type NoticeJob} from './channel-notifications';
export async function queueChannelNotices(tx:Prisma.TransactionClient,job:NoticeJob,change:Parameters<typeof channelNotices>[1]){
 const notices=channelNotices(job,change,process.env.AUTH_URL||'https://ad-creative-pipeline-nine.vercel.app');
 if(notices.length)await tx.outboxEvent.createMany({data:notices.map(n=>({type:'notification.channel',payload:{jobId:job.id,...n}}))});
}
