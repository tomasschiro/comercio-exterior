/**
 * Ensure tomasschiro1@gmail.com has rol=superadmin and aprobado=true.
 * Uses the Supabase REST API (PostgREST) with the service role key.
 * Run with: node scripts/ensure-superadmin.mjs
 */
import { readFileSync } from 'fs'

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
const TARGET_EMAIL = 'tomasschiro1@gmail.com'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function run() {
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  }

  // 1. Check current state
  console.log(`\nBuscando perfil de ${TARGET_EMAIL}...`)
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/perfiles?email=eq.${encodeURIComponent(TARGET_EMAIL)}&select=id,email,nombre,rol,aprobado`,
    { headers }
  )
  const perfiles = await getRes.json()

  if (!Array.isArray(perfiles) || perfiles.length === 0) {
    console.log('Perfil no encontrado. El usuario debe registrarse primero.')
    console.log('\nSi el usuario ya existe en auth.users pero no en perfiles, ejecutá este SQL manualmente:')
    console.log(`
INSERT INTO public.perfiles (id, email, nombre, rol, aprobado)
SELECT id, email, raw_user_meta_data->>'nombre', 'superadmin', true
FROM auth.users WHERE email = '${TARGET_EMAIL}'
ON CONFLICT (id) DO UPDATE SET rol = 'superadmin', aprobado = true;
    `)
    return
  }

  const perfil = perfiles[0]
  console.log('Perfil actual:', perfil)

  if (perfil.rol === 'superadmin' && perfil.aprobado === true) {
    console.log('\n✓ Ya tiene rol=superadmin y aprobado=true. Nada que hacer.')
    return
  }

  // 2. Update
  console.log('\nActualizando a superadmin...')
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/perfiles?email=eq.${encodeURIComponent(TARGET_EMAIL)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ rol: 'superadmin', aprobado: true }),
    }
  )

  if (!patchRes.ok) {
    const err = await patchRes.text()
    console.error('Error al actualizar:', err)
    return
  }

  const updated = await patchRes.json()
  console.log('Actualizado:', updated)
  console.log('\n✓ tomasschiro1@gmail.com ahora tiene rol=superadmin y aprobado=true.')
}

run().catch(console.error)
