import {AutoProcessor,AutoModelForVision2Seq,RawImage,TextStreamer,env} from './vendor/transformers-3.8.1.min.js';
const MODEL='HuggingFaceTB/SmolVLM-500M-Instruct';
let engine=null;
self.onmessage=async({data})=>{
 const {id,url,question,localAssets}=data;
 const status=text=>self.postMessage({id,type:'progress',text});
 try{
  env.allowLocalModels=!!localAssets;env.localModelPath='/models/';
  env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.wasmPaths='/vendor/';
  if(!engine){
   status('Loading vision model…');
   const processor=await AutoProcessor.from_pretrained(MODEL);
   const model=await AutoModelForVision2Seq.from_pretrained(MODEL,{device:'wasm',dtype:{embed_tokens:'fp32',vision_encoder:'fp32',decoder_model_merged:'q4'},progress_callback:p=>{if(p.status==='progress')status(`Loading model ${Math.round(p.progress||0)}%`);}});
   engine={processor,model};
  }
  const {processor,model}=engine;
  status('Reading photo…');
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('The photo could not be loaded.');
  const image=(await RawImage.fromBlob(await response.blob())).rgb();
  const prompt=processor.apply_chat_template([{role:'user',content:[{type:'image'},{type:'text',text:question}]}],{add_generation_prompt:true});
  const inputs=await processor(prompt,[image],{do_image_splitting:false});
  status('Writing description…');let count=0;
  const streamer=new TextStreamer(processor.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:()=>status(`Writing description… ${++count}`)});
  const generated=await model.generate({...inputs,max_new_tokens:140,do_sample:false,repetition_penalty:1.1,streamer});
  let answer=processor.batch_decode(generated.slice(null,[inputs.input_ids.dims.at(-1),null]),{skip_special_tokens:true})[0].replace(/\*\*/g,'').replace(/^#{1,6}\s+/gm,'').trim();
  if(!/[.!?]$/.test(answer)){const end=Math.max(answer.lastIndexOf('.'),answer.lastIndexOf('!'),answer.lastIndexOf('?'));if(end>answer.length/2)answer=answer.slice(0,end+1);}
  if(answer.length<3)throw new Error('No answer was generated. Try a more specific question.');
  self.postMessage({id,type:'result',answer});
 }catch(error){
  self.postMessage({id,type:'error',text:error instanceof Error?error.message:'Photo analysis could not be completed.'});
 }
};
