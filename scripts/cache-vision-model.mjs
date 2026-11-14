import {AutoProcessor,AutoModelForVision2Seq,env} from '@huggingface/transformers';
env.allowLocalModels=false;
const id='HuggingFaceTB/SmolVLM-500M-Instruct';
console.log('Downloading public vision model (about 810 MB). No paid API is used.');
await AutoProcessor.from_pretrained(id);
const model=await AutoModelForVision2Seq.from_pretrained(id,{device:'cpu',dtype:{embed_tokens:'fp32',vision_encoder:'fp32',decoder_model_merged:'q4'},progress_callback:p=>{if(p.status==='done')console.log('Ready:',p.file);}});
await model.dispose();
console.log('Model cached. The local development server can serve these files directly.');
