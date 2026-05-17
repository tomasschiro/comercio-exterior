'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Cliente, Transporte } from '@/types/database'

interface Props {
  clientes: Cliente[]
  transportes: Transporte[]
  userRol: string
}

const inputCls = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

// -------------------- Modals --------------------

function ModalNuevoCliente({ onSave, onClose, zIndex = 'z-50' }: {
  onSave: (c: Cliente) => void
  onClose: () => void
  zIndex?: string
}) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: dbErr } = await supabase
      .from('clientes')
      .insert({ nombre: form.nombre.trim(), email: form.email.trim() || null, telefono: form.telefono.trim() || null })
      .select()
      .single()
    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onSave(data)
  }

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Nuevo cliente</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className={inputCls} placeholder="Nombre del cliente" autoFocus required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className={inputCls} placeholder="email@ejemplo.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input type="text" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              className={inputCls} placeholder="+54 9 ..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !form.nombre.trim()}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNuevoTransporte({ onSave, onClose, zIndex = 'z-50' }: {
  onSave: (t: Transporte) => void
  onClose: () => void
  zIndex?: string
}) {
  const [form, setForm] = useState({ nombre: '', telefono: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: dbErr } = await supabase
      .from('transportes')
      .insert({ nombre: form.nombre.trim(), telefono: form.telefono.trim() || null })
      .select()
      .single()
    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onSave(data)
  }

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/40 backdrop-blur-sm p-4`}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Nuevo transporte</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className={inputCls} placeholder="Nombre del transporte" autoFocus required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input type="text" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              className={inputCls} placeholder="+54 9 ..." />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !form.nombre.trim()}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -------------------- TablaClientes --------------------

function TablaClientes({ clientes: init, isSuperadmin }: { clientes: Cliente[]; isSuperadmin: boolean }) {
  const [clientes, setClientes] = useState(init)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', email: '', telefono: '' })
  const [showNuevo, setShowNuevo] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  function startEdit(c: Cliente) {
    setEditId(c.id)
    setEditForm({ nombre: c.nombre, email: c.email ?? '', telefono: c.telefono ?? '' })
  }

  async function saveEdit() {
    if (!editId) return
    setLoadingId(editId)
    const supabase = createClient()
    const updates = {
      nombre: editForm.nombre.trim() || undefined,
      email: editForm.email.trim() || null,
      telefono: editForm.telefono.trim() || null,
    }
    const { error } = await supabase.from('clientes').update(updates).eq('id', editId)
    if (!error) {
      setClientes(prev => prev.map(c => c.id === editId ? { ...c, ...updates, nombre: editForm.nombre.trim() || c.nombre } : c))
      setEditId(null)
    }
    setLoadingId(null)
  }

  async function toggleActivo(c: Cliente, e: React.MouseEvent) {
    e.stopPropagation()
    setLoadingId(c.id)
    const supabase = createClient()
    const { error } = await supabase.from('clientes').update({ activo: !c.activo }).eq('id', c.id)
    if (!error) setClientes(prev => prev.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x))
    setLoadingId(null)
  }

  async function deleteCliente(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    setLoadingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('clientes').delete().eq('id', id)
    if (!error) {
      setClientes(prev => prev.filter(c => c.id !== id))
      if (editId === id) setEditId(null)
    }
    setLoadingId(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{clientes.length} registros</p>
        </div>
        {isSuperadmin && (
          <button onClick={() => setShowNuevo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo cliente
          </button>
        )}
      </div>

      {clientes.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-400">No hay clientes cargados</p>
          {isSuperadmin && (
            <button onClick={() => setShowNuevo(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Activo</th>
                {isSuperadmin && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientes.map(c => {
                const isEditing = editId === c.id
                const isLoading = loadingId === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => isSuperadmin && !isEditing && startEdit(c)}
                    className={`${isSuperadmin && !isEditing ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors ${isEditing ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="text" value={editForm.nombre}
                          onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                          onClick={e => e.stopPropagation()} className={inputCls} autoFocus />
                      ) : (
                        <span className="font-medium text-gray-900">{c.nombre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="email" value={editForm.email}
                          onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                          onClick={e => e.stopPropagation()} className={inputCls} placeholder="—" />
                      ) : (
                        <span className="text-gray-600">{c.email ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="text" value={editForm.telefono}
                          onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                          onClick={e => e.stopPropagation()} className={inputCls} placeholder="—" />
                      ) : (
                        <span className="text-gray-600">{c.telefono ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => toggleActivo(c, e)}
                        disabled={isLoading}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                          c.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    {isSuperadmin && (
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} disabled={isLoading || !editForm.nombre.trim()}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300">
                              {isLoading ? '...' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); startEdit(c) }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Editar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={e => deleteCliente(c.id, e)} disabled={isLoading}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Eliminar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <ModalNuevoCliente
          onSave={c => { setClientes(prev => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre))); setShowNuevo(false) }}
          onClose={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}

// -------------------- TablaTransportes --------------------

function TablaTransportes({ transportes: init, isSuperadmin }: { transportes: Transporte[]; isSuperadmin: boolean }) {
  const [transportes, setTransportes] = useState(init)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '' })
  const [showNuevo, setShowNuevo] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  function startEdit(t: Transporte) {
    setEditId(t.id)
    setEditForm({ nombre: t.nombre, telefono: t.telefono ?? '' })
  }

  async function saveEdit() {
    if (!editId) return
    setLoadingId(editId)
    const supabase = createClient()
    const updates = {
      nombre: editForm.nombre.trim() || undefined,
      telefono: editForm.telefono.trim() || null,
    }
    const { error } = await supabase.from('transportes').update(updates).eq('id', editId)
    if (!error) {
      setTransportes(prev => prev.map(t => t.id === editId ? { ...t, ...updates, nombre: editForm.nombre.trim() || t.nombre } : t))
      setEditId(null)
    }
    setLoadingId(null)
  }

  async function toggleActivo(t: Transporte, e: React.MouseEvent) {
    e.stopPropagation()
    setLoadingId(t.id)
    const supabase = createClient()
    const { error } = await supabase.from('transportes').update({ activo: !t.activo }).eq('id', t.id)
    if (!error) setTransportes(prev => prev.map(x => x.id === t.id ? { ...x, activo: !x.activo } : x))
    setLoadingId(null)
  }

  async function deleteTransporte(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este transporte? Esta acción no se puede deshacer.')) return
    setLoadingId(id)
    const supabase = createClient()
    const { error } = await supabase.from('transportes').delete().eq('id', id)
    if (!error) {
      setTransportes(prev => prev.filter(t => t.id !== id))
      if (editId === id) setEditId(null)
    }
    setLoadingId(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Transportes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{transportes.length} registros</p>
        </div>
        {isSuperadmin && (
          <button onClick={() => setShowNuevo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo transporte
          </button>
        )}
      </div>

      {transportes.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-400">No hay transportes cargados</p>
          {isSuperadmin && (
            <button onClick={() => setShowNuevo(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Teléfono</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Activo</th>
                {isSuperadmin && <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transportes.map(t => {
                const isEditing = editId === t.id
                const isLoading = loadingId === t.id
                return (
                  <tr
                    key={t.id}
                    onClick={() => isSuperadmin && !isEditing && startEdit(t)}
                    className={`${isSuperadmin && !isEditing ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors ${isEditing ? 'bg-blue-50/60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="text" value={editForm.nombre}
                          onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                          onClick={e => e.stopPropagation()} className={inputCls} autoFocus />
                      ) : (
                        <span className="font-medium text-gray-900">{t.nombre}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input type="text" value={editForm.telefono}
                          onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                          onClick={e => e.stopPropagation()} className={inputCls} placeholder="—" />
                      ) : (
                        <span className="text-gray-600">{t.telefono ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => toggleActivo(t, e)}
                        disabled={isLoading}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                          t.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    {isSuperadmin && (
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} disabled={isLoading || !editForm.nombre.trim()}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300">
                              {isLoading ? '...' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={e => { e.stopPropagation(); startEdit(t) }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Editar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={e => deleteTransporte(t.id, e)} disabled={isLoading}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Eliminar">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <ModalNuevoTransporte
          onSave={t => { setTransportes(prev => [...prev, t].sort((a, b) => a.nombre.localeCompare(b.nombre))); setShowNuevo(false) }}
          onClose={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}

// -------------------- Main export --------------------

export default function DashboardMaestros({ clientes, transportes, userRol }: Props) {
  const [tab, setTab] = useState<'clientes' | 'transportes'>('clientes')
  const isSuperadmin = userRol === 'superadmin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Maestros</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de clientes y transportes</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('clientes')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'clientes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Clientes
          </button>
          <button
            onClick={() => setTab('transportes')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'transportes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Transportes
          </button>
        </div>
      </div>

      {tab === 'clientes' ? (
        <TablaClientes clientes={clientes} isSuperadmin={isSuperadmin} />
      ) : (
        <TablaTransportes transportes={transportes} isSuperadmin={isSuperadmin} />
      )}
    </div>
  )
}

export { ModalNuevoCliente, ModalNuevoTransporte }
