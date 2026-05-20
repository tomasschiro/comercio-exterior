import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Header from '@/components/layout/Header'
import DashboardMaestros from '@/components/maestros/DashboardMaestros'

export default async function MaestrosPage() {
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
  if (userRol !== 'superadmin') redirect('/operaciones')

  const [{ data: clientes }, { data: transportes }] = await Promise.all([
    adminClient.from('clientes').select('*').order('nombre'),
    adminClient.from('transportes').select('*').order('nombre'),
  ])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <Header email={user.email} rol={userRol} />
      <main style={{ flex: 1, maxWidth: 1536, margin: '0 auto', width: '100%', padding: '24px' }}>
        <DashboardMaestros
          clientes={clientes ?? []}
          transportes={transportes ?? []}
          userRol={userRol}
        />
      </main>
    </div>
  )
}
