import type {NextConfig} from 'next';
import path from 'node:path';
const config:NextConfig={
 webpack(config,{webpack}){
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,path.resolve(process.cwd(),'lib/cloudflare-build-stub.ts')));
  return config;
 },
 async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'same-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}];}
};
export default config;
