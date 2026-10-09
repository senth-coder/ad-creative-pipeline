import Dashboard from './ui';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page() {
  if(process.env.NEXT_PUBLIC_DATA_MODE==='server') {const session=await auth();if(!session?.user?.email)redirect('/sign-in');}
  return <Dashboard/>;
}
