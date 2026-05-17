import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Header from '@/components/layout/Header'
import AdminPanel from '@/components/admin/AdminPanel'

export default async function AdminPage() {
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

  if (perfil?.rol !== 'superadmin') redirect('/operaciones')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header email={user.email} rol={perfil.rol} />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        <AdminPanel />
      </main>
    </div>
  )
}
