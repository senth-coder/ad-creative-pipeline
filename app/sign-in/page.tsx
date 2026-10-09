import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
export default function SignInPage(){
 if(process.env.NEXT_PUBLIC_DATA_MODE!=='server')redirect('/');
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0c1020'}}><div style={{background:'#181e30',padding:36,borderRadius:16,border:'1px solid #343c50',color:'#f2f3f8',width:360,textAlign:'center'}}><img src="/ghost-growth-workspace.webp" alt="Ghost Growth workspace" width={104} height={104} style={{borderRadius:24,marginBottom:20}}/><h1 style={{fontSize:23}}>Ghost Growth</h1><p style={{fontSize:13,color:'#8790a6'}}>Sign in with your @ghostgrowth.io Google account. New colleagues receive standard team access automatically.</p><form action={async()=>{'use server';await signIn('google',{redirectTo:'/'})}}><button className="primary-btn" style={{marginTop:15,width:'100%'}}>Continue with Google</button></form></div></main>;
}
