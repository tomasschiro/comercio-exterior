
-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: transportes
CREATE TABLE IF NOT EXISTS transportes (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columna transporte a operaciones (si no existe)
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS transporte TEXT;

-- RLS clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.aprobado = true)
);

DROP POLICY IF EXISTS "clientes_insert" ON clientes;
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

-- RLS transportes
ALTER TABLE transportes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transportes_select" ON transportes;
CREATE POLICY "transportes_select" ON transportes FOR SELECT USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.aprobado = true)
);

DROP POLICY IF EXISTS "transportes_insert" ON transportes;
CREATE POLICY "transportes_insert" ON transportes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

DROP POLICY IF EXISTS "transportes_update" ON transportes;
CREATE POLICY "transportes_update" ON transportes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);

DROP POLICY IF EXISTS "transportes_delete" ON transportes;
CREATE POLICY "transportes_delete" ON transportes FOR DELETE USING (
  EXISTS (SELECT 1 FROM perfiles p WHERE p.id = auth.uid() AND p.rol = 'superadmin' AND p.aprobado = true)
);
