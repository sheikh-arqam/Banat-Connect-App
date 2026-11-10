// Shared-database layer for Banat Connect.
//
// HOW SYNC WORKS
// ---------------
// When Supabase is configured (see .env.example), the whole app state is
// synced as one JSON document in the `app_state` table (row id = 'main').
// Every save uploads the state; every app open downloads the latest state,
// so a message sent on one phone appears on another phone after reload.
// This is last-write-wins and is right for a small institute app in v1.
//
// When Supabase is NOT configured, the app runs in clearly-labelled
// TEMPORARY LOCAL MODE: everything still works, but data saves only in
// this browser (localStorage) and does NOT sync to another device.
// Nothing here fakes sync — the banner in the app says which mode is live.
//
// TO TURN SYNC ON (Arqam)
// ------------------------
// 1. Create a free project at https://supabase.com (or reuse an existing
//    Banat project — do NOT reuse the Huffaz project).
// 2. In Supabase: SQL Editor -> run supabase/schema.sql from this repo.
// 3. In Vercel (the project created from this repo): Settings ->
//    Environment Variables -> add VITE_SUPABASE_URL (Project URL) and
//    VITE_SUPABASE_ANON_KEY (anon public key) -> Redeploy.
// 4. Never paste the service_role key anywhere — the anon key is enough.
//
// No keys are hard-coded here. No tokens from chat history are used.

import type { Store } from './store'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''

export function dbConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0
}

/** Short human-readable mode label shown in the app. */
export function dbModeLabel(): string {
  return dbConfigured() ? 'Shared database connected' : 'Temporary local mode'
}

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Download the shared state, or null when there is none / it cannot be read. */
export async function loadRemoteState(): Promise<Store | null> {
  if (!dbConfigured()) return null
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=data`, { headers: headers() }),
      8000,
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Array<{ data: Store }>
    if (!rows || rows.length === 0 || !rows[0].data || !Array.isArray((rows[0].data as Store).classes)) return null
    return rows[0].data as Store
  } catch {
    return null
  }
}

/** Upload the shared state. Returns true when Supabase accepted it. */
export async function saveRemoteState(store: Store): Promise<boolean> {
  if (!dbConfigured()) return false
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ id: 'main', data: store, updated_at: new Date().toISOString() }),
      }),
      8000,
    )
    return res.ok
  } catch {
    return false
  }
}

/** Quick connectivity check used once at startup to set the banner honestly. */
export async function checkRemoteReachable(): Promise<boolean> {
  if (!dbConfigured()) return false
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=id`, { headers: headers() }),
      8000,
    )
    return res.ok
  } catch {
    return false
  }
}
