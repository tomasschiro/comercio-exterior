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

  const admin = makeAdminClient()

  const [pendientesRes, activosRes] = await Promise.all([
    admin.from('perfiles').select('id, email, nombre, rol, aprobado, created_at').eq('aprobado', false).order('created_at', { ascending: true }),
    admin.from('perfiles').select('id, email, nombre, rol, aprobado, created_at').eq('aprobado', true).order('created_at', { ascending: true }),
  ])

  if (pendientesRes.error) return NextResponse.json({ error: pendientesRes.error.message }, { status: 500 })
  if (activosRes.error) return NextResponse.json({ error: activosRes.error.message }, { status: 500 })

  return NextResponse.json({ pendientes: pendientesRes.data ?? [], activos: activosRes.data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { action, userId, rol } = body
  const admin = makeAdminClient()

  if (action === 'approve') {
    const { error } = await admin.from('perfiles').update({ aprobado: true, rol: 'operador' }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject' || action === 'delete') {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'changeRole') {
    if (!['operador', 'superadmin'].includes(rol)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    const { error } = await admin.from('perfiles').update({ rol }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'deactivate') {
    const { error } = await admin.from('perfiles').update({ aprobado: false }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
