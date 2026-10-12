// Shared setup for the owner-run verification scripts (Node, not the app).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional file
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See docs/backend-setup.md.`);
    process.exit(1);
  }
  return value;
}

export const SUPABASE_URL = required("EXPO_PUBLIC_SUPABASE_URL");
export const ANON_KEY = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, noSession);

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, noSession);
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Creates a confirmed throwaway user (no email is sent) and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `aaharam-${label}-${Date.now()}@example.com`;
  const password = `Pw-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("createUser returned no user");
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined): Promise<void> {
  if (user) await admin.auth.admin.deleteUser(user.id);
}

let failures = 0;

export async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : JSON.stringify(err)}`);
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function finish(): never {
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}
