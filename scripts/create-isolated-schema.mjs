import assert from "node:assert/strict";
import postgres from "postgres";
import {createRequire} from "node:module";
// The pinned kit's ESM bundle contains unsupported dynamic requires on Node 26.
const {generateDrizzleJson,generateMigration}=createRequire(import.meta.url)("drizzle-kit/api");

/** Test-only bootstrap. Never accepts a production URL or an existing schema. */
export async function createIsolatedSchema(url) {
 const parsed=new URL(url);
 assert.equal(process.env.NODE_ENV,"test");
 assert.equal(parsed.hostname,"127.0.0.1");
 assert.match(parsed.pathname,/^\/arca_desktop_tests(?:_clean_build)?$/);
 const schema=await import("../lib/db/schema.ts");
 const snapshot=generateDrizzleJson(schema);
 const ddl=await generateMigration(generateDrizzleJson({}),snapshot);
 // drizzle-kit 0.28 push can return success after trying FKs before their
 // supporting unique indexes. Keep every statement; install FKs last.
 const rank=statement=>/FOREIGN KEY/i.test(statement)?2:/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(statement.trim())?1:0;
 const ordered=ddl.map((statement,index)=>({statement,index})).sort((a,b)=>rank(a.statement)-rank(b.statement)||a.index-b.index);
 const client=postgres(url,{max:1,onnotice:()=>{}});
 try {
  await client.begin(async tx=>{
   const [{n}]=await tx`select count(*)::int n from pg_tables where schemaname='public'`;
   assert.equal(n,0,"Only a new empty test database is allowed");
   for(const {statement} of ordered)await tx.unsafe(statement);
   const [{n:tables}]=await tx`select count(*)::int n from pg_tables where schemaname='public'`;
   const [{n:foreignKeys,invalid}]=await tx`select count(*)::int n,count(*) filter(where not c.convalidated)::int invalid from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'`;
   const expected=Object.values(snapshot.tables).reduce((sum,t)=>sum+Object.keys(t.foreignKeys).length,0);
   assert.equal(tables,Object.keys(snapshot.tables).length);
   assert.equal(foreignKeys,expected);assert.equal(invalid,0);
   console.log(JSON.stringify({isolatedSchemaComplete:true,tables,foreignKeys,allConstraintsValidated:true}));
  });
 } finally {await client.end();}
}

if(process.argv[1]?.replaceAll("\\","/").endsWith("/create-isolated-schema.mjs"))await createIsolatedSchema(process.env.ARCA_TEST_DATABASE_URL);
