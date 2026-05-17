import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifySuperadmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await anonClient.auth.getUser(token)
  if (!user) return false

  const { data: perfil } = await makeAdminClient()
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  return perfil?.rol === 'superadmin'
}

export async function GET(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await makeAdminClient()
    .from('perfiles')
    .select('id, email, nombre, rol, aprobado, created_at')
    .eq('aprobado', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { action, userId } = await request.json()

  if (action === 'approve') {
    const { error } = await makeAdminClient()
      .from('perfiles')
      .update({ aprobado: true, rol: 'operador' })
      .eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    const { error } = await makeAdminClient().auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
