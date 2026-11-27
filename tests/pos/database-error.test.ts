import {test} from "node:test";
import assert from "node:assert/strict";
import {databaseErrorCode,safeErrorMessage} from "../../lib/database-error";
import {inputMessage} from "../../lib/document-display";
test("wrapped SQLSTATE is preserved without exposing query or parameters",()=>{
 const cause=Object.assign(new Error("violates check constraint"),{code:"23514"});
 const error=new Error("Failed query: select secret; params: private@example.invalid",{cause});error.name="DrizzleQueryError";
 assert.equal(databaseErrorCode(error),"23514");assert.equal(safeErrorMessage(error,"No guardado"),"No guardado");assert.equal(inputMessage(error,"No guardado"),"No guardado");
 assert.equal(safeErrorMessage(new Error("No tienes permiso")),"No tienes permiso");
 assert.match(inputMessage(new Error("wrapper",{cause:Object.assign(new Error("missing"),{code:"42P01"})})),/esquema/);
});
test("malformed cause cycles do not hang",()=>{const error:Error & {cause?:unknown}=new Error("Revisa el formulario");error.cause=error;assert.equal(databaseErrorCode(error),undefined);assert.equal(safeErrorMessage(error),"Revisa el formulario");});
