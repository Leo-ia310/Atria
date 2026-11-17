import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const env={...process.env};
if(process.platform==='win32'){
  const nextRoot=path.dirname(require.resolve('next/package.json'));
  const wasmRoot=path.dirname(require.resolve('@next/swc-wasm-nodejs/package.json'));
  const next=JSON.parse(fs.readFileSync(path.join(nextRoot,'package.json'),'utf8'));
  const wasm=JSON.parse(fs.readFileSync(path.join(wasmRoot,'package.json'),'utf8'));
  if(next.version!==wasm.version)throw new Error('El compilador WASM debe coincidir con la versión exacta de Next.');
  // Next's Windows fallback expects an absolute package path here. Populate it from
  // the lockfile-pinned dependency instead of allowing a build-time network download.
  const target=path.join(nextRoot,'wasm','@next','swc-wasm-nodejs');
  fs.mkdirSync(target,{recursive:true});
  for(const file of ['package.json','wasm.js','wasm_bg.wasm'])fs.copyFileSync(path.join(wasmRoot,file),path.join(target,file));
  env.RAYON_NUM_THREADS??='1';env.GOMAXPROCS??='1';
  // Route parsing can load SWC before the experimental config reaches its loader.
  // Preload the pinned WASM bindings in every build worker, before that first use.
  const preload=pathToFileURL(path.join(import.meta.dirname,'preload-build-wasm.mjs')).href;
  env.NODE_OPTIONS=`${env.NODE_OPTIONS??''} --import=${preload}`.trim();
  env.NODE_ENV='production';
}
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'build',...process.argv.slice(2)],{stdio:'inherit',env});
child.on('error',error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
