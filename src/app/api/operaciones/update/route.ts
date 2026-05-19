import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_FIELDS = new Set([
  'interno', 'recep_doc', 'cliente', 'transporte', 'factura', 'oc',
  'fecha_pedido_fondos', 'crt', 'senasa', 'senasa_estado', 'senasa_vinculacion',
  'canal', 'despacho', 'oficializacion', 'aviso', 'nota_entrega', 'liberacion',
])

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: perfil } = await makeAdminClient()
    .from('perfiles')
    .select('aprobado')
    .eq('id', user.id)
    .single()
  if (!perfil?.aprobado) {
    return NextResponse.json({ error: 'Usuario no aprobado' }, { status: 403 })
  }

  const body = await request.json()
  const { id, updates } = body as { id: number; updates: Record<string, unknown> }

  if (!id || typeof id !== 'number') {
    return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  }
  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'updates requerido' }, { status: 400 })
  }

  const invalidFields = Object.keys(updates).filter(k => !ALLOWED_FIELDS.has(k))
  if (invalidFields.length > 0) {
    return NextResponse.json({ error: `Campos no permitidos: ${invalidFields.join(', ')}` }, { status: 400 })
  }

  const { error } = await makeAdminClient()
    .from('operaciones')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
