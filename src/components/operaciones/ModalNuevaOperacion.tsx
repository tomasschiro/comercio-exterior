'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { NuevaOperacion, Cliente, Transporte } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  userEmail?: string
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function getEmpty(): NuevaOperacion {
  return {
    interno: null, recep_doc: today(), cliente: null, transporte: null,
    factura: null, oc: null, fecha_pedido_fondos: null, crt: null,
    senasa: null, senasa_estado: null, senasa_vinculacion: null,
    canal: null, despacho: null, oficializacion: null,
    aviso: null, nota_entrega: null, liberacion: null,
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
  border: '0.5px solid #E8E5DE', borderRadius: 6, outline: 'none',
  color: '#0D0D0D', background: '#FFFFFF', fontFamily: 'inherit',
  transition: 'border-color 100ms, box-shadow 100ms',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#6B6860', marginBottom: 4,
}

function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#18181B'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)'
}
function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#E8E5DE'
  e.currentTarget.style.boxShadow = 'none'
}

function Chevron({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none', flexShrink: 0, ...style }}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

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
    try { await onSave(form) }
    catch (err) { setError(err instanceof Error ? err.message : 'Error'); setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid #E8E5DE' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9A94', display: 'flex', padding: 4 }}>
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map((f, i) => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}{f.required && ' *'}</label>
              <input type={f.type ?? 'text'} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={inputStyle} onFocus={handleFocus} onBlur={handleBlur}
                required={f.required} autoFocus={i === 0} />
            </div>
          ))}
          {error && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '0.5px solid #E8E5DE', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0 14px', height: 32, fontSize: 13, border: '0.5px solid #E8E5DE', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6B6860' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '0 14px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ModalNuevaOperacion({ open, onClose, onCreated, userEmail }: Props) {
  const [form, setForm] = useState<NuevaOperacion>(getEmpty)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ interno?: string; cliente?: string; general?: string }>({})
  const [savedMsg, setSavedMsg] = useState(false)
  const [showMas, setShowMas] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNuevoTransporte, setShowNuevoTransporte] = useState(false)
  const internoRef = useRef<HTMLInputElement>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(getEmpty())
    setErrors({})
    setSavedMsg(false)
    setShowMas(false)
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('transportes').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: c }, { data: t }]) => {
      setClientes(c ?? [])
      setTransportes(t ?? [])
    })
    setTimeout(() => internoRef.current?.focus(), 60)
  }, [open])

  // Cleanup timer on unmount
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  if (!open) return null

  function set(field: keyof NuevaOperacion, value: string) {
    if (field === 'interno') setErrors(p => ({ ...p, interno: undefined }))
    if (field === 'cliente') setErrors(p => ({ ...p, cliente: undefined }))
    setForm(prev => ({
      ...prev,
      [field]: value === '' ? null : (field === 'interno' ? parseInt(value) || null : value),
    }))
  }

  function handleClienteSelect(value: string) {
    if (value === '__new__') { setShowNuevoCliente(true); return }
    setErrors(p => ({ ...p, cliente: undefined }))
    setForm(prev => ({ ...prev, cliente: value || null }))
  }

  function handleTransporteSelect(value: string) {
    if (value === '__new__') { setShowNuevoTransporte(true); return }
    setForm(prev => ({ ...prev, transporte: value || null }))
  }

  function validate(): boolean {
    const errs: typeof errors = {}
    if (!form.interno) errs.interno = 'Obligatorio'
    if (!form.cliente) errs.cliente = 'Obligatorio'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors({})

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('operaciones').insert({
      ...form,
      created_by: user?.id,
      created_by_email: userEmail || user?.email,
    })

    if (error) {
      setErrors({ general: error.message })
      setLoading(false)
      return
    }

    setForm(getEmpty())
    setErrors({})
    setLoading(false)
    setSavedMsg(true)
    onCreated()
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSavedMsg(false), 3000)
    setTimeout(() => internoRef.current?.focus(), 30)
  }

  async function handleSaveNuevoCliente(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newC, error } = await supabase
      .from('clientes')
      .insert({ nombre: data.nombre.trim(), email: data.email?.trim() || null, telefono: data.telefono?.trim() || null })
      .select().single()
    if (error) throw new Error(error.message)
    setClientes(prev => [...prev, newC].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, cliente: newC.nombre }))
    setErrors(p => ({ ...p, cliente: undefined }))
    setShowNuevoCliente(false)
  }

  async function handleSaveNuevoTransporte(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newT, error } = await supabase
      .from('transportes')
      .insert({ nombre: data.nombre.trim(), telefono: data.telefono?.trim() || null })
      .select().single()
    if (error) throw new Error(error.message)
    setTransportes(prev => [...prev, newT].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, transporte: newT.nombre }))
    setShowNuevoTransporte(false)
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  // Selects don't submit on Enter natively — wire it explicitly on the last primary field
  function submitOnEnter(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() }
  }

  const errBorder = (field: 'interno' | 'cliente') =>
    errors[field] ? { borderColor: '#FCA5A5' } : {}

  return (
    <>
      <div
        onClick={handleBackdrop}
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: 16 }}
      >
        <div style={{ background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>

          {/* Header — sticky so it stays visible when scrolling "Más datos" */}
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '0.5px solid #E8E5DE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', margin: 0 }}>Nueva Operación</h2>
              {savedMsg && (
                <span style={{ fontSize: 11, fontWeight: 500, color: '#166534', background: '#E1F1D6', border: '0.5px solid #A3CFAA', borderRadius: 20, padding: '2px 9px' }}>
                  Guardada ✓
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9A94', display: 'flex', padding: 4, borderRadius: 4, transition: 'color 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0D0D0D' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9C9A94' }}
            >
              <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>

              {/* Interno */}
              <div>
                <label style={labelStyle}>
                  Interno <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  ref={internoRef}
                  type="number"
                  value={form.interno ?? ''}
                  onChange={e => set('interno', e.target.value)}
                  style={{ ...inputStyle, ...errBorder('interno') }}
                  onFocus={handleFocus} onBlur={handleBlur}
                  placeholder="Nº interno"
                />
                {errors.interno && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errors.interno}</p>}
              </div>

              {/* Recep. Doc — default hoy */}
              <div>
                <label style={labelStyle}>Recep. Documentos</label>
                <input
                  type="date"
                  value={form.recep_doc ?? ''}
                  onChange={e => set('recep_doc', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur}
                />
              </div>

              {/* Cliente — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>
                  Cliente <span style={{ color: '#DC2626' }}>*</span>
                </label>
                {clientes.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                    <span style={{ fontSize: 13, color: '#9C9A94' }}>Sin clientes cargados —</span>
                    <a href="/maestros" style={{ fontSize: 13, color: '#18181B', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      Ir a Maestros
                    </a>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.cliente ?? ''}
                      onChange={e => handleClienteSelect(e.target.value)}
                      style={{ ...selectStyle, ...errBorder('cliente') }}
                      onFocus={handleFocus} onBlur={handleBlur}
                    >
                      <option value="">— Seleccionar cliente —</option>
                      {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      <option value="__new__">+ Nuevo cliente...</option>
                    </select>
                    <Chevron />
                  </div>
                )}
                {errors.cliente && <p style={{ fontSize: 11, color: '#DC2626', margin: '3px 0 0' }}>{errors.cliente}</p>}
              </div>

              {/* OC */}
              <div>
                <label style={labelStyle}>OC</label>
                <input type="text" value={form.oc ?? ''} onChange={e => set('oc', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} placeholder="Nº OC del cliente" />
              </div>

              {/* Factura */}
              <div>
                <label style={labelStyle}>Factura</label>
                <input type="text" value={form.factura ?? ''} onChange={e => set('factura', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} placeholder="Nº factura" />
              </div>

              {/* CRT */}
              <div>
                <label style={labelStyle}>CRT</label>
                <input type="text" value={form.crt ?? ''} onChange={e => set('crt', e.target.value)}
                  style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} placeholder="Nº CRT" />
              </div>

              {/* Transporte — last primary field; Enter here submits */}
              <div>
                <label style={labelStyle}>Transporte</label>
                {transportes.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                    <span style={{ fontSize: 13, color: '#9C9A94' }}>Sin transportes —</span>
                    <a href="/maestros" style={{ fontSize: 13, color: '#18181B', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      Ir a Maestros
                    </a>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.transporte ?? ''}
                      onChange={e => handleTransporteSelect(e.target.value)}
                      onKeyDown={submitOnEnter}
                      style={selectStyle} onFocus={handleFocus} onBlur={handleBlur}
                    >
                      <option value="">— Sin transporte —</option>
                      {transportes.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      <option value="__new__">+ Nuevo transporte...</option>
                    </select>
                    <Chevron />
                  </div>
                )}
              </div>

              {/* Más datos — collapsible */}
              <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowMas(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B6860', padding: '4px 0', fontWeight: 500, transition: 'color 100ms' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#0D0D0D' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6B6860' }}
                >
                  <svg style={{ width: 12, height: 12, transform: showMas ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                  Más datos
                </button>

                {showMas && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #F0EDE8' }}>
                    <div>
                      <label style={labelStyle}>Fecha pedido fondos</label>
                      <input type="date" value={form.fecha_pedido_fondos ?? ''} onChange={e => set('fecha_pedido_fondos', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div>
                      <label style={labelStyle}>SENASA</label>
                      <input type="text" value={form.senasa ?? ''} onChange={e => set('senasa', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} placeholder="Nº SENASA" />
                    </div>
                    <div>
                      <label style={labelStyle}>N. Despacho</label>
                      <input type="text" value={form.despacho ?? ''} onChange={e => set('despacho', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} placeholder="Nº despacho" />
                    </div>
                    <div>
                      <label style={labelStyle}>Oficialización</label>
                      <input type="date" value={form.oficializacion ?? ''} onChange={e => set('oficializacion', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div>
                      <label style={labelStyle}>Aviso</label>
                      <input type="date" value={form.aviso ?? ''} onChange={e => set('aviso', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div>
                      <label style={labelStyle}>Nota de Entrega</label>
                      <input type="date" value={form.nota_entrega ?? ''} onChange={e => set('nota_entrega', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div>
                      <label style={labelStyle}>Liberación</label>
                      <input type="date" value={form.liberacion ?? ''} onChange={e => set('liberacion', e.target.value)}
                        style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {errors.general && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
                {errors.general}
              </div>
            )}

            {/* Footer: Cerrar a la izquierda, Guardar a la derecha */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #E8E5DE' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0 14px', height: 32, fontSize: 13, border: '0.5px solid #E8E5DE', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6B6860', transition: 'background 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F5' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0 16px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 120ms' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#27272A' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#18181B' }}
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
