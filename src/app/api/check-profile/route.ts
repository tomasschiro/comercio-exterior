import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { access_token } = await request.json()

  if (!access_token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Verify the token and get the user identity
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: userError } = await anonClient.auth.getUser(access_token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Use service role to bypass broken RLS policies and read the profile
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: perfil } = await adminClient
    .from('perfiles')
    .select('aprobado, rol')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    aprobado: perfil?.aprobado ?? false,
    rol: perfil?.rol ?? null,
  })
}
