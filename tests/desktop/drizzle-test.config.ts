import { defineConfig } from "drizzle-kit";

const value = process.env.ARCA_TEST_DATABASE_URL;
if (!value) throw new Error("Falta la base aislada de pruebas.");
const url = new URL(value);
if (url.hostname !== "127.0.0.1" || !url.pathname.startsWith("/arca_desktop_tests")) throw new Error("Las pruebas solo pueden crear el esquema en PostgreSQL local aislado.");
export default defineConfig({ schema:"./lib/db/schema.ts",dialect:"postgresql",dbCredentials:{url:value},verbose:false,strict:false });
