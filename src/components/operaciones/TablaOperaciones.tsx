'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Operacion } from '@/types/database'
import { getEstadoOperacion } from '@/types/database'
import ModalNuevaOperacion from './ModalNuevaOperacion'

const ESTADO_COLORS: Record<string, string> = {
  'Liberado':        'bg-green-100 text-green-800',
  'Nota de entrega': 'bg-blue-100 text-blue-800',
  'Avisado':         'bg-purple-100 text-purple-800',
  'Oficializado':    'bg-yellow-100 text-yellow-800',
  'En proceso':      'bg-orange-100 text-orange-800',
  'Pendiente':       'bg-gray-100 text-gray-600',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [year, month, day] = d.split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  userEmail?: string
}

export default function TablaOperaciones({ userEmail }: Props) {
  const [operaciones, setOperaciones] = useState<Operacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const cargarOperaciones = useCallback(async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('operaciones')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setOperaciones(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargarOperaciones()
  }, [cargarOperaciones])

  const filtradas = operaciones.filter(op => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      op.cliente?.toLowerCase().includes(q) ||
      op.despacho?.toLowerCase().includes(q) ||
      op.crt?.toLowerCase().includes(q) ||
      op.senasa?.toLowerCase().includes(q) ||
      String(op.interno ?? '').includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Operaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Cargando...' : `${filtradas.length} registro${filtradas.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente, despacho..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={cargarOperaciones}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Nueva Operación */}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva operación
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Interno</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Recep. Doc</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">CRT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">SENASA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">N. Despacho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Oficialización</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Aviso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nota de entrega</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Liberación</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cargando operaciones...
                    </div>
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-400">
                        {busqueda ? 'Sin resultados para la búsqueda' : 'No hay operaciones cargadas aún'}
                      </p>
                      {!busqueda && (
                        <button
                          onClick={() => setModalOpen(true)}
                          className="mt-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + Nueva operación
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtradas.map(op => {
                  const estado = getEstadoOperacion(op)
                  return (
                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {op.interno ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(op.recep_doc)}</td>
                      <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={op.cliente ?? ''}>
                        {op.cliente || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{op.crt || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{op.senasa || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{op.despacho || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(op.oficializacion)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(op.aviso)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(op.nota_entrega)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(op.liberacion)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ESTADO_COLORS[estado]}`}>
                          {estado}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalNuevaOperacion
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={cargarOperaciones}
        userEmail={userEmail}
      />
    </div>
  )
}
