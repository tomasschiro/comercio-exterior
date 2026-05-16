
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
