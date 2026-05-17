'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface PerfilPendiente {
  id: string
  email: string
  nombre: string | null
  created_at: string
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export default function AdminPanel() {
  const [pendientes, setPendientes] = useState<PerfilPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchPendientes = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) setPendientes(data)
    else setError(data.error ?? 'Error al cargar usuarios')
    setLoading(false)
  }, [])

  useEffect(() => { fetchPendientes() }, [fetchPendientes])

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setActionLoading(userId + action)
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, userId }),
    })
    if (res.ok) {
      setPendientes(prev => prev.filter(p => p.id !== userId))
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al procesar la acción')
    }
    setActionLoading(null)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Panel de administración</h1>
        <p className="text-sm text-gray-500 mt-0.5">Usuarios pendientes de aprobación</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando...
          </div>
        ) : pendientes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
            <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">No hay usuarios pendientes de aprobación</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha de registro</th>
                <th className="px-4 py-3 w-48" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendientes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 font-medium">{p.nombre || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.email}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(p.id, 'approve')}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded-lg transition-colors"
                      >
                        {actionLoading === p.id + 'approve' ? 'Aprobando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => handleAction(p.id, 'reject')}
                        disabled={actionLoading !== null}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors"
                      >
                        {actionLoading === p.id + 'reject' ? 'Rechazando...' : 'Rechazar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
