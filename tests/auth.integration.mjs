import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import { NextRequest } from "next/server.js";
const root = process.cwd();
const moduleUrl = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64");
const schemaUrl = moduleUrl((await readFile("src/lib/auth-schema.ts", "utf8")).replace('"zod"', JSON.stringify(pathToFileURL(path.join(root, "node_modules/zod/index.js")).href)));
const { signupSchema, loginSchema } = await import(schemaUrl);
assert.equal(signupSchema.safeParse({ name: "Sam", email: "sam@example.com", phone: "", password: "Strong123!", cPassword: "different" }).success, false);
assert.equal(loginSchema.safeParse({ email: "sam@example.com", password: "old" }).success, true);
const signupValues = { name: "Sam", email: "sam@example.com", phone: "", password: "Strong123!", cPassword: "Strong123!" };
for (const phone of ["", "01001234567", " 01001234567 "]) assert.equal(signupSchema.safeParse({ ...signupValues, phone }).success, true);
for (const phone of ["+20 100 123 4567", "0100123456", "010012345678", "01001abc567"]) assert.equal(signupSchema.safeParse({ ...signupValues, phone }).success, false);
let received;
let upstreamMode = "success";
const server = createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  received = { path: req.url, method: req.method, body: JSON.parse(body) };
  res.setHeader("Content-Type", "application/json");
  if (upstreamMode === "error") { res.statusCode = 400; res.end(JSON.stringify({ msgError: "wrong password", stack: "private" })); }
  else if (upstreamMode === "validation") { res.statusCode = 400; res.end(JSON.stringify({ message: "Validation Error", validationErr: [{ path: ["phone"], type: "string.length", message: "private submitted value", context: { value: "private" } }] })); }
  else if (upstreamMode === "otp") { res.statusCode = 400; res.end(JSON.stringify({ msgError: "wrong OTP" })); }
  else if (req.url === "/auth/passcode" || req.url === "/auth/resetcode") { res.end(JSON.stringify({ message: "done" })); }
  else if (upstreamMode === "internal") { res.statusCode = 500; res.end(JSON.stringify({ msgError: "private database details" })); }
  else if (req.url === "/auth/signup") { res.statusCode = 201; res.end(JSON.stringify({ user: { password: "never expose" } })); }
  else res.end(JSON.stringify({ token: "test-session-token" }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
process.env.API_BASE_URL = "http://127.0.0.1:" + server.address().port;
const routeSource = (await readFile("src/app/api/auth/[action]/route.ts", "utf8"))
  .replace('"@/lib/auth-schema"', JSON.stringify(schemaUrl))
  .replace('"next/server"', JSON.stringify(pathToFileURL(path.join(root, "node_modules/next/server.js")).href));
const { POST } = await import(moduleUrl(routeSource));
const call = (action, body, origin = "http://localhost:3001") => POST(new NextRequest("http://localhost:3001/api/auth/" + action, {
  method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body),
}), { params: Promise.resolve({ action }) });
try {
  const signup = await call("signup", { name: " Sam ", email: "SAM@example.com", phone: "", password: "Strong123!", cPassword: "Strong123!" });
  assert.equal(signup.status, 201);
  assert.equal(received.path, "/auth/signup");
  assert.equal(received.body.email, "sam@example.com");
  assert.equal(received.body.name, "Sam");
  assert.equal("phone" in received.body, false);
  assert.equal(JSON.stringify(await signup.json()).includes("password"), false);
  const login = await call("login", { email: "sam@example.com", password: "old" });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(login.headers.get("set-cookie"), /SameSite=lax/i);
  assert.equal(JSON.stringify(await login.json()).includes("test-session-token"), false);
  const withPhone = await call("signup", { ...signupValues, phone: "01001234567" });
  assert.equal(withPhone.status, 201);
  assert.equal(received.body.phone, "01001234567");
  const invalidPhone = await call("signup", { ...signupValues, phone: "+20 100 123 4567" });
  assert.equal(invalidPhone.status, 400);
  assert.match((await invalidPhone.json()).message, /11-digit/);

  const codeSent = await call("passcode", { email: "SAM@example.com" });
  assert.equal(codeSent.status, 200);
  assert.equal(received.method, "PATCH");
  assert.equal(received.path, "/auth/passcode");
  assert.deepEqual(received.body, { email: "sam@example.com" });
  const resetValues = { email: "sam@example.com", otp: "0123", password: "Strong123!", cPassword: "Strong123!" };
  assert.equal((await call("resetcode", { ...resetValues, otp: "123" })).status, 400);
  assert.equal((await call("resetcode", { ...resetValues, cPassword: "Mismatch123!" })).status, 400);
  upstreamMode = "otp";
  const wrongCode = await call("resetcode", resetValues);
  assert.equal(wrongCode.status, 400);
  assert.match((await wrongCode.json()).message, /code is incorrect/);
  upstreamMode = "success";
  const resetDone = await call("resetcode", resetValues);
  assert.equal(resetDone.status, 200);
  assert.equal(received.method, "PATCH");
  assert.equal(received.path, "/auth/resetcode");
  assert.deepEqual(received.body, resetValues);
  assert.match(resetDone.headers.get("set-cookie"), /Max-Age=0/i);
  upstreamMode = "validation";
  const validationError = await call("signup", signupValues);
  assert.equal(validationError.status, 400);
  const validationBody = await validationError.json();
  assert.match(validationBody.message, /11-digit/);
  assert.equal(JSON.stringify(validationBody).includes("private"), false);
  upstreamMode = "error";
  const rejected = await call("login", { email: "sam@example.com", password: "bad" });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).message, /confirm your email/);
  upstreamMode = "internal";
  const failed = await call("login", { email: "sam@example.com", password: "bad" });
  assert.equal(failed.status, 503);
  assert.equal(JSON.stringify(await failed.json()).includes("private"), false);
  assert.equal((await call("login", { email: "bad", password: "" })).status, 400);
  assert.equal((await call("login", {}, "https://untrusted.example")).status, 403);
  assert.equal((await call("unknown", {})).status, 404);
  assert.match((await call("logout", {})).headers.get("set-cookie"), /Max-Age=0/i);
  console.log("Auth integration checks passed: schemas, upstream payloads, cookie, redaction, errors, origin, logout.");
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
