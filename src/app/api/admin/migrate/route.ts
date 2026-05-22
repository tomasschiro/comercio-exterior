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
    .from('perfiles').select('rol').eq('id', user.id).single()
  return perfil?.rol === 'superadmin'
}

export async function GET(request: NextRequest) {
  if (!await verifySuperadmin(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const admin = makeAdminClient()
  const sqlParts: string[] = []

  const { error: mailErr } = await admin.from('operaciones').select('mail_enviado').limit(0)
  if (mailErr) sqlParts.push('ALTER TABLE public.operaciones ADD COLUMN IF NOT EXISTS mail_enviado boolean NOT NULL DEFAULT false;')

  const { error: tipoErr } = await admin.from('operaciones').select('tipo').limit(0)
  if (tipoErr) sqlParts.push("ALTER TABLE public.operaciones ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'importacion';")

  if (sqlParts.length === 0) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false, sql: sqlParts.join('\n') })
}
