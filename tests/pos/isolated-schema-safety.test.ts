import {test} from "node:test";
import assert from "node:assert/strict";

test("schema bootstrap refuses non-test execution, remote hosts and other databases",async()=>{
 const {createIsolatedSchema}=await import("../../scripts/create-isolated-schema.mjs");
 const previous=process.env.NODE_ENV;
 try {
  Object.assign(process.env,{NODE_ENV:"production"});
  await assert.rejects(createIsolatedSchema("postgresql://test:test@127.0.0.1/arca_desktop_tests"));
  Object.assign(process.env,{NODE_ENV:"test"});
  await assert.rejects(createIsolatedSchema("postgresql://test:test@example.com/arca_desktop_tests"));
  await assert.rejects(createIsolatedSchema("postgresql://test:test@127.0.0.1/business"));
 } finally {if(previous===undefined)Reflect.deleteProperty(process.env,"NODE_ENV");else Object.assign(process.env,{NODE_ENV:previous});}
});
