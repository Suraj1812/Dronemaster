export const MODEL_ID = 'Xenova/mobilevit-xx-small';
export const MODEL_DTYPE = 'fp32' as const;
export const PIPELINE_VERSION = 'mobilevit-fp32-v1';
export type ImageLabel = {label:string;score:number};
let classifierPromise: Promise<unknown> | null = null;
// Keep inference sequential: multiple photo cards share a single model session.
let inferenceQueue: Promise<unknown> = Promise.resolve();
export async function classifyPhoto(url:string,onProgress:(status:string)=>void):Promise<ImageLabel[]> {
 const task = inferenceQueue.catch(()=>{}).then(async()=>{
  const {pipeline,env,RawImage}=await import('@huggingface/transformers');
  env.allowLocalModels=false;
  if(env.backends.onnx.wasm)env.backends.onnx.wasm.numThreads=1;
  if(!classifierPromise)classifierPromise=pipeline('image-classification',MODEL_ID,{
   device:'wasm',dtype:MODEL_DTYPE,
   progress_callback:(p:unknown)=>{const event=p as {status:string;progress?:number};if(event.status==='progress'&&event.progress)onProgress(Math.round(event.progress)+'%');}
  }).catch(e=>{classifierPromise=null;throw e;});
  const classifier=await classifierPromise as (image:unknown,options:{top_k:number})=>Promise<ImageLabel[]>;
  onProgress('Processing…');
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Could not load the inspection photo.');
  const image=(await RawImage.fromBlob(await response.blob())).rgb();
  const result=await classifier(image,{top_k:3});
  if(!Array.isArray(result)||!result.length||result.some(p=>!Number.isFinite(p.score)||p.score<0||p.score>1))throw new Error('The image model returned an invalid result.');
  return result;
 });
 inferenceQueue=task;
 return task;
}
