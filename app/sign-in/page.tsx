import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
export default function SignInPage(){
 if(process.env.NEXT_PUBLIC_DATA_MODE!=='server')redirect('/');
 return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f7f8fb'}}><div style={{background:'#fff',padding:36,borderRadius:16,border:'1px solid #e8ebf2',width:360,textAlign:'center'}}><div style={{fontSize:30,fontWeight:800,color:'#6546d7'}}>GG</div><h1 style={{fontSize:23}}>Ghost Growth</h1><p style={{fontSize:13,color:'#8790a6'}}>Sign in with your approved Google Workspace account.</p><form action={async()=>{'use server';await signIn('google',{redirectTo:'/'})}}><button className="primary-btn" style={{marginTop:15,width:'100%'}}>Continue with Google</button></form></div></main>;
}
