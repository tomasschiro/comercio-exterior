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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(request: NextRequest) {
  console.log('ENV CHECK:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    console.log('token presente:', !!token)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token)
    console.log('getUser:', { userId: user?.id, userError: userError?.message })
    if (userError || !user) {
      return NextResponse.json({ error: 'Token inválido', detail: userError?.message }, { status: 401 })
    }

    const { data: perfil, error: perfilError } = await makeAdminClient()
      .from('perfiles')
      .select('aprobado')
      .eq('id', user.id)
      .single()
    console.log('perfil:', { perfil, perfilError: perfilError?.message })
    if (!perfil?.aprobado) {
      return NextResponse.json({ error: 'Usuario no aprobado' }, { status: 403 })
    }

    const body = await request.json()
    const { id, updates } = body as { id: number; updates: Record<string, unknown> }
    console.log('body:', { id, updates })

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

    const adminClient = makeAdminClient()
    console.log('adminClient key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20))
    const { error } = await adminClient
      .from('operaciones')
      .update(updates)
      .eq('id', id)
    console.log('update result:', JSON.stringify({ message: error?.message, code: error?.code, details: error?.details, hint: error?.hint }))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err))
    console.error('EXCEPCIÓN en /api/operaciones/update:', e.message, e.stack)
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
