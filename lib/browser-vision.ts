export const VISION_MODEL='HuggingFaceTB/SmolVLM-500M-Instruct';
export const VISION_VERSION='smolvlm-500m-v1';
type State={worker:Worker|null;queue:Promise<unknown>};
const globals=globalThis as typeof globalThis & {__dronemasterWorkerV4?:State};
const shared=globals.__dronemasterWorkerV4??={worker:null,queue:Promise.resolve()};
export async function describePhoto(url:string,question:string,status:(text:string)=>void,signal?:AbortSignal):Promise<string>{
 const task=shared.queue.catch(()=>{}).then(()=>new Promise<string>((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Analysis cancelled','AbortError'));return;}
  const worker=shared.worker??=new Worker('/vision-worker.js',{type:'module'});
  const id=crypto.randomUUID();
  function clean(){worker.removeEventListener('message',message);worker.removeEventListener('error',error);signal?.removeEventListener('abort',abort);}
  function stop(){worker.terminate();if(shared.worker===worker)shared.worker=null;}
  function abort(){clean();stop();reject(new DOMException('Analysis cancelled','AbortError'));}
  function error(event:ErrorEvent){console.error('Vision worker:',event.message,event.filename,event.lineno);clean();stop();reject(new Error('The image-analysis worker could not start. Reload the page and try again.'));}
  function message(event:MessageEvent){const data=event.data;if(data.id!==id)return;if(data.type==='progress')status(data.text);else if(data.type==='result'){clean();resolve(data.answer);}else if(data.type==='error'){clean();stop();reject(new Error(data.text));}}
  worker.addEventListener('message',message);worker.addEventListener('error',error);signal?.addEventListener('abort',abort,{once:true});
  worker.postMessage({id,url:new URL(url,location.origin).href,question,localAssets:['127.0.0.1','localhost'].includes(location.hostname)});
 }));
 shared.queue=task;return task;
}
