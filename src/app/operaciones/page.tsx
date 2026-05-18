import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Header from '@/components/layout/Header'
import TablaOperaciones from '@/components/operaciones/TablaOperaciones'

export default async function OperacionesPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: perfil } = await adminClient
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  const userRol = perfil?.rol ?? 'operador'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header email={user.email} rol={userRol} />
      <main style={{ flex: 1, maxWidth: 1600, margin: '0 auto', width: '100%', padding: '20px 24px 48px' }}>
        <TablaOperaciones userEmail={user.email} userId={user.id} userRol={userRol} />
      </main>
    </div>
  )
}
