/**
 * Add senasa_estado and senasa_vinculacion columns to operaciones.
 * Run with: node scripts/add-senasa-cols.mjs
 */
import pg from 'pg'
import { readFileSync } from 'fs'

const { Client } = pg

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

const ref = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
const host = ref ? `db.${ref}.supabase.co` : null

const SQL = `
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS senasa_estado  text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS senasa_vinculacion date;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'operaciones'
  AND column_name IN ('senasa_estado', 'senasa_vinculacion')
ORDER BY column_name;
`

async function run() {
  const connectionStrings = [
    DATABASE_URL,
    host ? `postgresql://postgres:${SERVICE_ROLE_KEY}@${host}:5432/postgres?sslmode=require` : null,
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
      const rows = Array.isArray(result) ? result[result.length - 1].rows : result.rows
      console.log('Columnas creadas/verificadas:')
      console.table(rows)
      await client.end()
      return
    } catch (err) {
      console.log(`  Error: ${err.message}`)
      try { await client.end() } catch {}
    }
  }

  console.log('\n========================================================')
  console.log('No se pudo conectar. Ejecutá el siguiente SQL manualmente en:')
  console.log('https://supabase.com/dashboard/project/xlleanhoffeskegphdzq/editor')
  console.log('========================================================\n')
  console.log(SQL)
}

run().catch(console.error)
