import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = mkdtempSync(path.join(os.tmpdir(), "railway-auth-check-"));
const mock = path.join(directory, "mock.cjs");
writeFileSync(
  mock,
  `
const assert=require('node:assert/strict');
const fs=require('node:fs');
const exists=fs.existsSync;
fs.existsSync=(file)=>String(file).endsWith('/.env')?false:exists(file);
global.fetch=async(url,request)=>{
 assert.equal(url,'https://backboard.railway.com/graphql/v2');
 const expected=process.env.RAILWAY_API_TOKEN||process.env.RAILWAY_TOKEN;
 if(process.env.RAILWAY_API_TOKEN){
  assert.equal(request.headers.Authorization,'Bearer '+expected);
  assert.equal(request.headers['Project-Access-Token'],undefined);
 }else{
  assert.equal(request.headers['Project-Access-Token'],expected);
  assert.equal(request.headers.Authorization,undefined);
 }
 assert(request.signal instanceof AbortSignal);
 const {query}=JSON.parse(request.body);
 assert(!/\\bmutation\\b/i.test(query));
 if(process.env.TEST_AUTH_FAIL)return{ok:false,status:401,json:async()=>({errors:[{message:'Not Authorized '+expected}]})};
 if(query.includes('variables('))return{ok:true,json:async()=>({data:{variables:{AUTH_SECRET:expected,EMPTY:'',SEALED:null}}})};
 if(query.includes('projectToken'))return{ok:true,json:async()=>({data:{projectToken:{projectId:'fixture-project',environmentId:'fixture-production'}}})};
 if(query.includes('project(id:'))return{ok:true,json:async()=>({data:{project:{id:'fixture-project',name:'Fixture'}}})};
 return{ok:true,json:async()=>({data:{me:{id:'fixture-user',name:'Fixture',email:'fixture@example.invalid'}}})};
};
`,
);
const token = randomBytes(32).toString("hex");
function run(key, args, failure = false) {
  const env = {
    PATH: process.env.PATH,
    HOME: directory,
    [key]: token,
    ...(failure ? { TEST_AUTH_FAIL: "1" } : {}),
  };
  const result = spawnSync(
    process.execPath,
    ["-r", mock, path.join(root, "scripts/server/railway/railway.cjs"), ...args],
    { cwd: directory, env, encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.ok(
    !(result.stdout + result.stderr).includes(token),
    "Credentials must not appear in output",
  );
  return result;
}
try {
  for (const key of ["RAILWAY_API_TOKEN", "RAILWAY_TOKEN"]) {
    const login = run(key, ["login"]);
    assert.equal(login.status, 0);
    assert.match(login.stdout, /Authenticated/);
    assert.equal(run(key, ["login"], true).status, 1);
  }
  assert.equal(run("RAILWAY_TOKEN", ["list"]).status, 0);
  mkdirSync(path.join(directory, ".railway"));
  writeFileSync(
    path.join(directory, ".railway/project.json"),
    JSON.stringify({ projectId: "fixture-project" }),
  );
  assert.equal(run("RAILWAY_API_TOKEN", ["status"]).status, 0);
  assert.equal(run("RAILWAY_API_TOKEN", ["status"], true).status, 1);
  assert.match(run("RAILWAY_TOKEN", ["whoami"]).stdout, /fixture-project/);
  const variables = run("RAILWAY_API_TOKEN", [
    "variable",
    "list",
    "--environment",
    "fixture-production",
    "--service",
    "fixture-service",
    "--presence-only",
  ]);
  assert.equal(variables.status, 0);
  assert.deepEqual(JSON.parse(variables.stdout), {
    AUTH_SECRET: { configured: true, sealedOrUnavailable: false },
    EMPTY: { configured: false, sealedOrUnavailable: false },
    SEALED: { configured: false, sealedOrUnavailable: true },
  });
  console.log(
    "PASS Railway account/project headers, scope checks, rejected credentials, bounded read-only requests and secret-free variable presence output",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
