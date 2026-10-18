import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the project keeps required service placeholders out of source code", async () => {
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_ANON_KEY=/);
  assert.match(envExample, /GEMINI_API_KEY=/);
  assert.doesNotMatch(envExample, /service_role/i);
});

test("the product name and problem focus are present in the landing page", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const login = await readFile(new URL("../components/LoginScreen.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/GuestDashboard.tsx", import.meta.url), "utf8");

  assert.match(page, /GuestDashboard/);
  assert.match(login, /SwaPulse/);
  assert.match(login, /<em>AI<\/em>/);
  assert.match(login, /Login as a Guest/);
  assert.match(login, /RECOMMENDED/);
  assert.match(login, /Health Centre Manager/);
  assert.match(login, /Health Worker/);
  assert.match(dashboard, /AI ACTION LOG/);
  assert.match(dashboard, /runDemoAction/);
});
