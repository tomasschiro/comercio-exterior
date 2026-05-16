/**
 * Fix infinite-recursion RLS policies on the `perfiles` table.
 * Run with: node scripts/fix-rls.mjs
 *
 * Requires DATABASE_URL or individual DB_* env vars.
 * If not set, falls back to Supabase default connection details
 * and uses the service role key as password (for newer Supabase projects).
 */
import pg from 'pg'
import { readFileSync } from 'fs'

const { Client } = pg

// Load .env.local manually (no dotenv dependency needed)
const env = {}
try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
} catch {}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL

// Derive host from Supabase URL: https://ref.supabase.co -> db.ref.supabase.co
const ref = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const host = ref ? `db.${ref}.supabase.co` : null

const SQL = `
-- ============================================================
-- Fix infinite-recursion RLS policies on perfiles
-- ============================================================

-- 1. Create a SECURITY DEFINER helper function that reads a user's
--    role without triggering RLS (avoids the recursive policy call)
CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol::text FROM public.perfiles WHERE id = auth.uid();
$$;

-- 2. Drop all existing policies on perfiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfiles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- 3. Ensure RLS is enabled
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 4. Simple non-recursive policies
--    SELECT: each user can read their own row
CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

--    UPDATE: each user can update their own row
CREATE POLICY "perfiles_update_own"
  ON public.perfiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

--    INSERT: superadmins can insert (uses helper fn, no recursion)
--    In practice inserts come from triggers or service_role, so restrict to service_role
CREATE POLICY "perfiles_insert_service_role"
  ON public.perfiles FOR INSERT
  TO service_role
  WITH CHECK (true);

--    DELETE: service_role only
CREATE POLICY "perfiles_delete_service_role"
  ON public.perfiles FOR DELETE
  TO service_role
  USING (true);

--    Superadmins can read all profiles (uses helper fn to avoid recursion)
CREATE POLICY "perfiles_select_superadmin"
  ON public.perfiles FOR SELECT
  TO authenticated
  USING (public.get_my_rol() = 'superadmin');

--    Superadmins can update any profile
CREATE POLICY "perfiles_update_superadmin"
  ON public.perfiles FOR UPDATE
  TO authenticated
  USING (public.get_my_rol() = 'superadmin')
  WITH CHECK (public.get_my_rol() = 'superadmin');

-- 5. Verify
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'perfiles'
ORDER BY policyname;
`

async function run() {
  const connectionStrings = [
    DATABASE_URL,
    // Supabase direct connection with service role key as password
    host ? `postgresql://postgres:${SERVICE_ROLE_KEY}@${host}:5432/postgres?sslmode=require` : null,
    // Supabase connection pooler (transaction mode)
    ref ? `postgresql://postgres.${ref}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres` : null,
    ref ? `postgresql://postgres.${ref}:${SERVICE_ROLE_KEY}@aws-0-us-west-1.pooler.supabase.com:6543/postgres` : null,
    ref ? `postgresql://postgres.${ref}:${SERVICE_ROLE_KEY}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres` : null,
  ].filter(Boolean)

  for (const connStr of connectionStrings) {
    const displayStr = connStr.replace(SERVICE_ROLE_KEY, '[REDACTED]')
    console.log(`\nIntentando conectar a: ${displayStr}`)
    const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 8000 })
    try {
      await client.connect()
      console.log('Conexión exitosa. Ejecutando SQL...\n')
      const result = await client.query(SQL)
      // Last query is the SELECT of policies
      const rows = Array.isArray(result) ? result[result.length - 1].rows : result.rows
      console.log('Políticas creadas:')
      console.table(rows)
      await client.end()
      return
    } catch (err) {
      console.log(`  Error: ${err.message}`)
      try { await client.end() } catch {}
    }
  }

  console.log('\n========================================================')
  console.log('No se pudo conectar a la base de datos automáticamente.')
  console.log('\nEjecuta el siguiente SQL manualmente en:')
  console.log('https://supabase.com/dashboard/project/xlleanhoffeskegphdzq/editor')
  console.log('========================================================\n')
  console.log(SQL)
}

run().catch(console.error)
