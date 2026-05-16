'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { NuevaOperacion } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  userEmail?: string
}

const EMPTY: NuevaOperacion = {
  interno: null,
  recep_doc: null,
  cliente: null,
  crt: null,
  senasa: null,
  despacho: null,
  oficializacion: null,
  aviso: null,
  nota_entrega: null,
  liberacion: null,
}

export default function ModalNuevaOperacion({ open, onClose, onCreated, userEmail }: Props) {
  const [form, setForm] = useState<NuevaOperacion>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  function handleChange(field: keyof NuevaOperacion, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value === '' ? null : (field === 'interno' ? parseInt(value) || null : value),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('operaciones').insert({
      ...form,
      created_by: user?.id,
      created_by_email: userEmail || user?.email,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setForm(EMPTY)
    setLoading(false)
    onCreated()
    onClose()
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva Operación</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Interno */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Interno</label>
              <input
                type="number"
                value={form.interno ?? ''}
                onChange={e => handleChange('interno', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nº interno"
              />
            </div>

            {/* Recep. Doc */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recep. Documentos</label>
              <input
                type="date"
                value={form.recep_doc ?? ''}
                onChange={e => handleChange('recep_doc', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Cliente - span 2 */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
              <input
                type="text"
                value={form.cliente ?? ''}
                onChange={e => handleChange('cliente', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del cliente"
              />
            </div>

            {/* CRT */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CRT</label>
              <input
                type="text"
                value={form.crt ?? ''}
                onChange={e => handleChange('crt', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nº CRT"
              />
            </div>

            {/* SENASA */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SENASA</label>
              <input
                type="text"
                value={form.senasa ?? ''}
                onChange={e => handleChange('senasa', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nº SENASA"
              />
            </div>

            {/* N. Despacho */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N. Despacho</label>
              <input
                type="text"
                value={form.despacho ?? ''}
                onChange={e => handleChange('despacho', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nº despacho"
              />
            </div>

            {/* Oficializacion */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Oficialización</label>
              <input
                type="date"
                value={form.oficializacion ?? ''}
                onChange={e => handleChange('oficializacion', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Aviso */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aviso</label>
              <input
                type="date"
                value={form.aviso ?? ''}
                onChange={e => handleChange('aviso', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Nota Entrega */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota de Entrega</label>
              <input
                type="date"
                value={form.nota_entrega ?? ''}
                onChange={e => handleChange('nota_entrega', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Liberacion */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Liberación</label>
              <input
                type="date"
                value={form.liberacion ?? ''}
                onChange={e => handleChange('liberacion', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Guardando...' : 'Guardar operación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
