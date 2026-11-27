import {test} from "node:test";
import assert from "node:assert/strict";
import {PgDialect} from "drizzle-orm/pg-core";
test("PostgreSQL identifier delimiters are escaped as data",()=>{
 const dialect=new PgDialect();
 assert.equal(dialect.escapeName('name"; SELECT 1; --'),'"name""; SELECT 1; --"');
 assert.equal(dialect.escapeName('normal_column'),'"normal_column"');
});
