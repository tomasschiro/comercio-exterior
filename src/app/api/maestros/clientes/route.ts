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
    .from('clientes')
    .select('*')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { nombre, email, telefono } = await request.json()
  const { data, error } = await makeAdminClient()
    .from('clientes')
    .insert({ nombre, email: email || null, telefono: telefono || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id, ...updates } = await request.json()
  const { error } = await makeAdminClient()
    .from('clientes')
    .update(updates)
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await request.json()
  const { error } = await makeAdminClient()
    .from('clientes')
    .delete()
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
