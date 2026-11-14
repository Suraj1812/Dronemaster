// Optional real inference regression. Supply an Alpine mountain fixture locally.
// User photos are never committed; no paid API is called.
import assert from 'node:assert/strict';
import {pipeline,env} from '@huggingface/transformers';
import {MODEL_ID,MODEL_DTYPE} from '../lib/browser-classifier.ts';
const image=process.argv[2];
if(!image)throw new Error('Usage: node tests/check_image_model.mjs /path/to/alpine-mountain-image.jpg');
env.allowLocalModels=false;
const classifier=await pipeline('image-classification',MODEL_ID,{dtype:MODEL_DTYPE,device:'cpu'});
try{
 const labels=await classifier(image,{top_k:3});
 assert.equal(labels[0].label,'alp','Mountain fixture must not regress to the quantized oscilloscope result');
 assert.ok(labels[0].score>=0.5,'Mountain fixture should establish a useful top result');
 console.log(JSON.stringify({model:MODEL_ID,dtype:MODEL_DTYPE,labels},null,2));
}finally{await classifier.dispose();}
