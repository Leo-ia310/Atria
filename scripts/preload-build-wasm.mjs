import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Build-only adapter for the exact Next version pinned in package-lock.json.
// Fail closed if a future Next version changes this binding API.
const bindings=await require('next/dist/build/swc').loadBindings(true);
if(bindings.isWasm!==true)throw new Error('El build Windows requiere el compilador WASM fijado de Next.');
