import {NextResponse,type NextRequest} from 'next/server';
export function proxy(request:NextRequest){
 const cookie=request.cookies.get('dronemaster_session')?.value;
 if(cookie&&/^[a-f0-9]{64}$/.test(cookie))return NextResponse.next();
 const bytes=crypto.getRandomValues(new Uint8Array(32));const session=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');
 const headers=new Headers(request.headers);const old=headers.get('cookie');headers.set('cookie',(old?old+'; ':'')+'dronemaster_session='+session);
 const response=NextResponse.next({request:{headers}});response.cookies.set('dronemaster_session',session,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:60*60*24*180});return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|vendor/|vision-worker.js|models/).*)']};
