/** Private server-to-server identity bridge. Browser callers never receive the key. */
const encoder=new TextEncoder();
export async function bridgeSignature(secret:string,timestamp:string,method:string,path:string,session:string,body:Uint8Array){
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body as BufferSource))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,encoder.encode([timestamp,method,path,session,digest].join('\n')));
 return Array.from(new Uint8Array(signature)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function bridgeIdentity(request:Request,secret?:string){
 if(!secret||secret.length<32)return null;
 const session=request.headers.get('x-dronemaster-session')||'',timestamp=request.headers.get('x-dronemaster-timestamp')||'',provided=request.headers.get('x-dronemaster-signature')||'';
 if(!/^[a-f0-9]{64}$/.test(session)||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>60000||!/^[a-f0-9]{64}$/.test(provided))return null;
 const body=new Uint8Array(await request.clone().arrayBuffer());
 const expected=await bridgeSignature(secret,timestamp,request.method,new URL(request.url).pathname,session,body);
 let mismatch=0;for(let i=0;i<64;i++)mismatch|=expected.charCodeAt(i)^provided.charCodeAt(i);
 return mismatch?null:{userId:'guest:'+session};
}
