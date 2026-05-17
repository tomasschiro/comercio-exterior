'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { NuevaOperacion, Cliente, Transporte } from '@/types/database'

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
  transporte: null,
  crt: null,
  senasa: null,
  senasa_estado: null,
  senasa_vinculacion: null,
  despacho: null,
  oficializacion: null,
  aviso: null,
  nota_entrega: null,
  liberacion: null,
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const selectCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

// Mini modal for adding a new client/transporte from within the form
function MiniModal({ title, fields, onSave, onClose }: {
  title: string
  fields: { key: string; label: string; type?: string; required?: boolean }[]
  onSave: (data: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, '']))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}{f.required && ' *'}</label>
              <input
                type={f.type ?? 'text'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className={inputCls}
                required={f.required}
                autoFocus={fields.indexOf(f) === 0}
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ModalNuevaOperacion({ open, onClose, onCreated, userEmail }: Props) {
  const [form, setForm] = useState<NuevaOperacion>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNuevoTransporte, setShowNuevoTransporte] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('transportes').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: c }, { data: t }]) => {
      setClientes(c ?? [])
      setTransportes(t ?? [])
    })
  }, [open])

  if (!open) return null

  function handleChange(field: keyof NuevaOperacion, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value === '' ? null : (field === 'interno' ? parseInt(value) || null : value),
    }))
  }

  function handleClienteSelect(value: string) {
    if (value === '__new__') { setShowNuevoCliente(true); return }
    handleChange('cliente', value)
  }

  function handleTransporteSelect(value: string) {
    if (value === '__new__') { setShowNuevoTransporte(true); return }
    handleChange('transporte', value)
  }

  async function handleSaveNuevoCliente(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newC, error: dbErr } = await supabase
      .from('clientes')
      .insert({ nombre: data.nombre.trim(), email: data.email?.trim() || null, telefono: data.telefono?.trim() || null })
      .select()
      .single()
    if (dbErr) throw new Error(dbErr.message)
    setClientes(prev => [...prev, newC].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, cliente: newC.nombre }))
    setShowNuevoCliente(false)
  }

  async function handleSaveNuevoTransporte(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newT, error: dbErr } = await supabase
      .from('transportes')
      .insert({ nombre: data.nombre.trim(), telefono: data.telefono?.trim() || null })
      .select()
      .single()
    if (dbErr) throw new Error(dbErr.message)
    setTransportes(prev => [...prev, newT].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, transporte: newT.nombre }))
    setShowNuevoTransporte(false)
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
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={handleBackdrop}
      >
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Interno */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Interno</label>
                <input
                  type="number"
                  value={form.interno ?? ''}
                  onChange={e => handleChange('interno', e.target.value)}
                  className={inputCls}
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
                  className={inputCls}
                />
              </div>

              {/* Cliente - select */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
                {clientes.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">No hay clientes cargados —</span>
                    <button
                      type="button"
                      onClick={() => setShowNuevoCliente(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Agregar uno
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.cliente ?? ''}
                    onChange={e => handleClienteSelect(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— Sin cliente —</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                    <option value="__new__">+ Nuevo cliente</option>
                  </select>
                )}
              </div>

              {/* Transporte - select */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Transporte</label>
                {transportes.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">No hay transportes cargados —</span>
                    <button
                      type="button"
                      onClick={() => setShowNuevoTransporte(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Agregar uno
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.transporte ?? ''}
                    onChange={e => handleTransporteSelect(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— Sin transporte —</option>
                    {transportes.map(t => (
                      <option key={t.id} value={t.nombre}>{t.nombre}</option>
                    ))}
                    <option value="__new__">+ Nuevo transporte</option>
                  </select>
                )}
              </div>

              {/* CRT */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CRT</label>
                <input
                  type="text"
                  value={form.crt ?? ''}
                  onChange={e => handleChange('crt', e.target.value)}
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
                />
              </div>

              {/* Aviso */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aviso</label>
                <input
                  type="date"
                  value={form.aviso ?? ''}
                  onChange={e => handleChange('aviso', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Nota Entrega */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nota de Entrega</label>
                <input
                  type="date"
                  value={form.nota_entrega ?? ''}
                  onChange={e => handleChange('nota_entrega', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Liberacion */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Liberación</label>
                <input
                  type="date"
                  value={form.liberacion ?? ''}
                  onChange={e => handleChange('liberacion', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

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

      {showNuevoCliente && (
        <MiniModal
          title="Nuevo cliente"
          fields={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'telefono', label: 'Teléfono' },
          ]}
          onSave={handleSaveNuevoCliente}
          onClose={() => setShowNuevoCliente(false)}
        />
      )}

      {showNuevoTransporte && (
        <MiniModal
          title="Nuevo transporte"
          fields={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'telefono', label: 'Teléfono' },
          ]}
          onSave={handleSaveNuevoTransporte}
          onClose={() => setShowNuevoTransporte(false)}
        />
      )}
    </>
  )
}
