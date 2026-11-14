import {proxyInspectionApi} from '@/lib/vercel-api';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
async function handle(request:Request){
 if(process.env.DRONEMASTER_BACKEND_ORIGIN)return proxyInspectionApi(request);
 const {handleApi}=await import('@/lib/inspection-api');return handleApi(request);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
