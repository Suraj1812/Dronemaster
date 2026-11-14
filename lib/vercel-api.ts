import {cookies} from 'next/headers';
import {bridgeSignature} from './bridge-auth';
export async function proxyInspectionApi(request:Request){
 const target=process.env.DRONEMASTER_BACKEND_ORIGIN,secret=process.env.DRONEMASTER_BRIDGE_SECRET;
 if(!target||!secret)return Response.json({error:'Storage connection is not configured.'},{status:503});
 const url=new URL(request.url);const session=(await cookies()).get('dronemaster_session')?.value;
 if(!session||!/^[a-f0-9]{64}$/.test(session))return Response.json({error:'Reload the page to start a workspace.'},{status:401});
 if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)return Response.json({error:'Cross-origin request blocked.'},{status:403});
 const max=4*1024*1024;const reader=request.body?.getReader();const parts:Uint8Array[]=[];let size=0;
 if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();return Response.json({error:'Choose a photo smaller than 4 MB.'},{status:413});}parts.push(value);}}finally{reader.releaseLock();}}
 const body=new Uint8Array(size);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length;}
 const timestamp=String(Date.now());const signature=await bridgeSignature(secret,timestamp,request.method,url.pathname,session,body);
 const upstream=new URL(url.pathname+url.search,target);const headers=new Headers({'x-dronemaster-session':session,'x-dronemaster-timestamp':timestamp,'x-dronemaster-signature':signature,'Origin':upstream.origin});
 for(const key of ['content-type','if-none-match']){const value=request.headers.get(key);if(value)headers.set(key,value);}
 try{
  const response=await fetch(upstream,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:body,cache:'no-store',signal:AbortSignal.timeout(25000)});
  const returned=new Headers();for(const key of ['content-type','content-disposition','etag','retry-after']){const value=response.headers.get(key);if(value)returned.set(key,value);}
  returned.set('Cache-Control','private, no-store');returned.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers:returned});
 }catch{return Response.json({error:'Storage could not be reached. Please retry.'},{status:502});}
}
