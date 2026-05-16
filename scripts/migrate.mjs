#!/usr/bin/env node
/**
 * Migration script - ejecuta el schema de comercio exterior en Supabase
 * Usa el service role key para autenticación directa
 */

const PROJECT_REF = 'xlleanhoffeskegphdzq'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsbGVhbmhvZmZlc2tlZ3BoZHpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc2NTY4MiwiZXhwIjoyMDk0MzQxNjgyfQ.6nehyMwc9dRYkTMOnwSNhymQXrw5afX198S6E0TCbkM'

const FULL_SCHEMA = `
-- ============================================================
-- SCHEMA: Gestión de Comercio Exterior
-- ============================================================

-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social TEXT NOT NULL,
  cuit TEXT NOT NULL,
  pais TEXT NOT NULL DEFAULT 'Argentina',
  ciudad TEXT,
  direccion TEXT,
  email TEXT,
  telefono TEXT,
  contacto_nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social TEXT NOT NULL,
  identificacion_fiscal TEXT,
  pais TEXT NOT NULL,
  ciudad TEXT,
  direccion TEXT,
  email TEXT,
  telefono TEXT,
  contacto_nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: partidas arancelarias
CREATE TABLE IF NOT EXISTS partidas_arancelarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  alicuota_import NUMERIC(5,2),
  alicuota_export NUMERIC(5,2),
  unidad_medida TEXT
);

-- Tabla principal: operaciones de comercio exterior
CREATE TABLE IF NOT EXISTS operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_expediente TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('importacion', 'exportacion')),
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','en_proceso','en_transito','en_aduana','liberado','cerrado','cancelado')),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  descripcion_mercaderia TEXT NOT NULL,
  partida_arancelaria TEXT,
  valor_fob NUMERIC(15,2),
  moneda TEXT NOT NULL DEFAULT 'USD',
  modo_transporte TEXT NOT NULL DEFAULT 'maritimo' CHECK (modo_transporte IN ('maritimo','aereo','terrestre','multimodal')),
  pais_origen TEXT,
  pais_destino TEXT,
  puerto_origen TEXT,
  puerto_destino TEXT,
  fecha_embarque DATE,
  fecha_arribo_estimada DATE,
  fecha_arribo_real DATE,
  numero_bl_awb TEXT,
  numero_despacho TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: documentos asociados a operaciones
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('factura_comercial','lista_empaque','conocimiento_embarque','certificado_origen','poliza_seguro','DUA','otro')),
  nombre TEXT NOT NULL,
  numero_referencia TEXT,
  fecha_emision DATE,
  archivo_url TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Función: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS set_updated_at_clientes ON clientes;
CREATE TRIGGER set_updated_at_clientes
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_proveedores ON proveedores;
CREATE TRIGGER set_updated_at_proveedores
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_operaciones ON operaciones;
CREATE TRIGGER set_updated_at_operaciones
  BEFORE UPDATE ON operaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_operaciones_tipo ON operaciones(tipo);
CREATE INDEX IF NOT EXISTS idx_operaciones_estado ON operaciones(estado);
CREATE INDEX IF NOT EXISTS idx_operaciones_cliente ON operaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_proveedor ON operaciones(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_documentos_operacion ON documentos(operacion_id);

-- RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas_arancelarias ENABLE ROW LEVEL SECURITY;

-- Policies (acceso total para MVP)
DROP POLICY IF EXISTS "allow_all" ON clientes;
CREATE POLICY "allow_all" ON clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON proveedores;
CREATE POLICY "allow_all" ON proveedores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON operaciones;
CREATE POLICY "allow_all" ON operaciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON documentos;
CREATE POLICY "allow_all" ON documentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all" ON partidas_arancelarias;
CREATE POLICY "allow_all" ON partidas_arancelarias FOR ALL USING (true) WITH CHECK (true);

-- Datos de ejemplo: partidas arancelarias
INSERT INTO partidas_arancelarias (codigo, descripcion, alicuota_import, alicuota_export, unidad_medida) VALUES
  ('8471.30.00', 'Máquinas automáticas para tratamiento de datos, portátiles', 14.0, 0.0, 'U'),
  ('8517.12.00', 'Teléfonos para redes celulares u otras redes inalámbricas', 16.0, 0.0, 'U'),
  ('2701.12.00', 'Hulla bituminosa', 0.0, 5.0, 'TN'),
  ('1001.19.00', 'Trigo duro, excepto para siembra', 0.0, 12.0, 'TN'),
  ('0201.10.00', 'Carne bovina en canales o medias canales, fresca o refrigerada', 0.0, 9.0, 'KG'),
  ('7208.51.00', 'Productos laminados planos de hierro o acero sin alear', 10.5, 0.0, 'TN'),
  ('3004.90.00', 'Medicamentos para uso humano, mezclas o sin mezclar', 0.0, 0.0, 'U'),
  ('8703.23.00', 'Vehículos automóviles de turismo, cilindrada > 1500 cc ≤ 3000 cc', 35.0, 0.0, 'U'),
  ('1507.10.00', 'Aceite de soja en bruto', 0.0, 33.0, 'KG'),
  ('2709.00.00', 'Aceites crudos de petróleo o de mineral bituminoso', 0.0, 8.0, 'KG')
ON CONFLICT (codigo) DO NOTHING;

-- Datos de ejemplo: clientes
INSERT INTO clientes (razon_social, cuit, pais, ciudad, email, telefono, contacto_nombre) VALUES
  ('Importaciones del Sur S.A.', '30-12345678-9', 'Argentina', 'Buenos Aires', 'operaciones@importacionesdelsur.com', '+54 11 4567-8901', 'Carlos Rodríguez'),
  ('Exportadora Pampeana S.R.L.', '30-98765432-1', 'Argentina', 'Rosario', 'comercio@pampeana.com.ar', '+54 341 456-7890', 'María González'),
  ('Global Trade Argentina S.A.', '30-11223344-5', 'Argentina', 'Córdoba', 'gta@globaltrade.com.ar', '+54 351 789-0123', 'Roberto Martínez')
ON CONFLICT DO NOTHING;

-- Datos de ejemplo: proveedores
INSERT INTO proveedores (razon_social, identificacion_fiscal, pais, ciudad, email, contacto_nombre) VALUES
  ('China Manufacturing Co. Ltd.', 'CN-91310000MA1XXXXXX', 'China', 'Shanghai', 'sales@chinamanuf.cn', 'Wei Zhang'),
  ('Brazilian Exports Corp', 'CNPJ 12.345.678/0001-90', 'Brasil', 'São Paulo', 'export@brazilcorp.com.br', 'João Silva'),
  ('European Quality GmbH', 'DE123456789', 'Alemania', 'Hamburgo', 'trade@europeanquality.de', 'Hans Müller'),
  ('US Commodities LLC', 'EIN 12-3456789', 'Estados Unidos', 'Houston', 'trade@uscommodities.com', 'John Smith')
ON CONFLICT DO NOTHING;

-- Datos de ejemplo: operaciones
INSERT INTO operaciones (
  numero_expediente, tipo, estado, descripcion_mercaderia, valor_fob, moneda,
  modo_transporte, pais_origen, pais_destino, puerto_origen, puerto_destino,
  fecha_embarque, fecha_arribo_estimada, numero_bl_awb
) VALUES
  ('IMP-2026-001', 'importacion', 'en_transito', 'Equipos de computación portátiles', 85000.00, 'USD',
   'maritimo', 'China', 'Argentina', 'Shanghai', 'Buenos Aires',
   '2026-04-15', '2026-05-20', 'MAEU123456789'),
  ('EXP-2026-001', 'exportacion', 'liberado', 'Harina de trigo para uso alimentario', 120000.00, 'USD',
   'maritimo', 'Argentina', 'Brasil', 'Rosario', 'Santos',
   '2026-04-01', '2026-04-10', 'MSC987654321'),
  ('IMP-2026-002', 'importacion', 'en_aduana', 'Autopartes y componentes mecánicos', 45000.00, 'USD',
   'aereo', 'Alemania', 'Argentina', 'Frankfurt', 'Ezeiza',
   '2026-05-10', '2026-05-12', 'LH123456')
ON CONFLICT (numero_expediente) DO NOTHING;
`

async function runMigration() {
  console.log('🚀 Ejecutando migraciones en Supabase...\n')

  // Intentar via Management API con service role key como bearer
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: FULL_SCHEMA })
  })

  if (response.ok) {
    console.log('✅ Migraciones ejecutadas via Management API')
    return
  }

  const err1 = await response.text()
  console.log(`ℹ️  Management API (${response.status}): ${err1.substring(0, 100)}`)

  // Intentar via REST endpoint de supabase
  const response2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: FULL_SCHEMA })
  })

  if (response2.ok) {
    console.log('✅ Migraciones ejecutadas via REST RPC')
    return
  }

  console.log(`ℹ️  REST RPC (${response2.status})`)
  console.log('\n⚠️  No se pudo ejecutar el SQL automáticamente.')
  console.log('📋 Para aplicar el schema manualmente:')
  console.log('   1. Ir a https://supabase.com/dashboard/project/xlleanhoffeskegphdzq/sql')
  console.log('   2. Copiar el contenido de: scripts/schema.sql')
  console.log('   3. Ejecutar en el SQL Editor\n')
}

runMigration().catch(console.error)
