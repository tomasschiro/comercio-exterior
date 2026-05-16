import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header email={user.email} />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        <TablaOperaciones userEmail={user.email} />
      </main>
    </div>
  )
}
