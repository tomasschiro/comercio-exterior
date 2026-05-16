/**
 * Setup Supabase: crea todas las tablas, triggers y políticas RLS
 * Intenta conexión directa via Supabase Supavisor (JWT auth)
 */

const { createRequire } = await import('module')
const require = createRequire(import.meta.url)
const { Client } = require('pg')

const PROJECT_REF = 'xlleanhoffeskegphdzq'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbGVhbmhvZmZlc2tlZ3BoZHpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc2NTY4MiwiZXhwIjoyMDk0MzQxNjgyfQ.6nehyMwc9dRYkTMOnwSNhymQXrw5afX198S6E0TCbkM'

const SCHEMA_SQL = `
-- DROP tablas existentes
DROP TABLE IF EXISTS operaciones CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;

-- Tabla: perfiles (vinculada a auth.users)
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'operador' CHECK (rol IN ('superadmin', 'operador')),
  aprobado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: operaciones de comercio exterior
CREATE TABLE operaciones (
  id BIGSERIAL PRIMARY KEY,
  interno INTEGER,
  recep_doc DATE,
  cliente TEXT,
  crt TEXT,
  senasa TEXT,
  despacho TEXT,
  oficializacion DATE,
  aviso DATE,
  nota_entrega DATE,
  liberacion DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, rol, aprobado)
  VALUES (NEW.id, NEW.email, 'operador', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfil_propio" ON perfiles;
CREATE POLICY "perfil_propio" ON perfiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "superadmin_perfiles" ON perfiles;
CREATE POLICY "superadmin_perfiles" ON perfiles FOR ALL USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

DROP POLICY IF EXISTS "aprobados_select" ON operaciones;
CREATE POLICY "aprobados_select" ON operaciones FOR SELECT USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.aprobado = true)
);

DROP POLICY IF EXISTS "aprobados_insert" ON operaciones;
CREATE POLICY "aprobados_insert" ON operaciones FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.aprobado = true)
);

DROP POLICY IF EXISTS "aprobados_update" ON operaciones;
CREATE POLICY "aprobados_update" ON operaciones FOR UPDATE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.aprobado = true)
);

DROP POLICY IF EXISTS "superadmin_delete" ON operaciones;
CREATE POLICY "superadmin_delete" ON operaciones FOR DELETE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

-- Insertar perfil superadmin si el usuario ya existe
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'tomasschiro1@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO perfiles (id, email, rol, aprobado)
    VALUES (v_uid, 'tomasschiro1@gmail.com', 'superadmin', true)
    ON CONFLICT (id) DO UPDATE SET rol = 'superadmin', aprobado = true;
    RAISE NOTICE 'Perfil superadmin configurado para tomasschiro1@gmail.com';
  ELSE
    RAISE NOTICE 'Registrate con tomasschiro1@gmail.com y re-ejecuta el script para activar superadmin';
  END IF;
END $$;
`

async function tryConnect(connectionString, label) {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    console.log(`✅ Conectado via ${label}`)
    await client.query(SCHEMA_SQL)
    console.log('✅ Schema aplicado exitosamente!\n')
    console.log('Tablas creadas: perfiles, operaciones')
    console.log('Trigger: handle_new_user')
    console.log('RLS policies: configuradas\n')
    await client.end()
    return true
  } catch (err) {
    console.log(`⚠️  ${label}: ${err.message.substring(0, 120)}`)
    try { await client.end() } catch (_) {}
    return false
  }
}

async function main() {
  console.log('🚀 Configurando Supabase - Comercio Exterior\n')

  const attempts = [
    // Transaction mode via Supavisor (JWT auth)
    [`postgresql://postgres.${PROJECT_REF}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
     'Supavisor Transaction (us-east-1)'],
    // Session mode
    [`postgresql://postgres.${PROJECT_REF}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
     'Supavisor Session (us-east-1)'],
    // Direct DB
    [`postgresql://postgres:${SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
     'Direct DB'],
  ]

  for (const [connStr, label] of attempts) {
    const ok = await tryConnect(connStr, label)
    if (ok) {
      console.log('🎉 Setup completado!')
      process.exit(0)
    }
  }

  // Fallback: guardar SQL
  const { writeFileSync } = await import('fs')
  writeFileSync('./supabase/schema.sql', SCHEMA_SQL, 'utf8')
  console.log('\n📋 SQL guardado en supabase/schema.sql')
  console.log('👉 Ir a: https://supabase.com/dashboard/project/xlleanhoffeskegphdzq/sql/new')
  console.log('   y pegar el contenido de supabase/schema.sql\n')
  process.exit(0)
}

main()
