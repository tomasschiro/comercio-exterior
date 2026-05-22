import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function makeAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifySuperadmin(token: string | null): Promise<boolean> {
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

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
    if (!await verifySuperadmin(token)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id, nombre_archivo } = await req.json() as { id: number; nombre_archivo: string }

    const admin = makeAdminClient()

    // Remove from storage (ignore if file already gone)
    await admin.storage.from('reportes').remove([nombre_archivo])

    // Delete DB record
    const { error: dbError } = await admin
      .from('reportes_semanales')
      .delete()
      .eq('id', id)

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
