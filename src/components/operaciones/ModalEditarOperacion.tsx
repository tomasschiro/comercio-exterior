'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Operacion, Cliente, Transporte } from '@/types/database'

interface Props {
  op: Operacion
  onClose: () => void
  onSaved: (updated: Operacion) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 14,
  border: '0.5px solid #E8E5DE',
  borderRadius: 6,
  outline: 'none',
  color: '#0D0D0D',
  background: '#FFFFFF',
  transition: 'border-color 100ms, box-shadow 100ms',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#6B6860',
  marginBottom: 4,
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#18181B'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#E8E5DE'
  e.currentTarget.style.boxShadow = 'none'
}

export default function ModalEditarOperacion({ op, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    interno:             op.interno !== null ? String(op.interno) : '',
    recep_doc:           op.recep_doc           ?? '',
    cliente:             op.cliente             ?? '',
    transporte:          op.transporte          ?? '',
    factura:             op.factura             ?? '',
    oc:                  op.oc                  ?? '',
    fecha_pedido_fondos: op.fecha_pedido_fondos ?? '',
    crt:                 op.crt                 ?? '',
    senasa:              op.senasa              ?? '',
    despacho:            op.despacho            ?? '',
    oficializacion:      op.oficializacion      ?? '',
    aviso:               op.aviso               ?? '',
    nota_entrega:        op.nota_entrega        ?? '',
    liberacion:          op.liberacion          ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportes, setTransportes] = useState<Transporte[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('transportes').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: c }, { data: t }]) => {
      setClientes(c ?? [])
      setTransportes(t ?? [])
    })
  }, [])

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const updates = {
      interno:             form.interno.trim()             ? (parseInt(form.interno) || null) : null,
      recep_doc:           form.recep_doc.trim()           || null,
      cliente:             form.cliente.trim()             || null,
      transporte:          form.transporte.trim()          || null,
      factura:             form.factura.trim()             || null,
      oc:                  form.oc.trim()                  || null,
      fecha_pedido_fondos: form.fecha_pedido_fondos.trim() || null,
      crt:                 form.crt.trim()                 || null,
      senasa:              form.senasa.trim()              || null,
      despacho:            form.despacho.trim()            || null,
      oficializacion:      form.oficializacion.trim()      || null,
      aviso:               form.aviso.trim()               || null,
      nota_entrega:        form.nota_entrega.trim()        || null,
      liberacion:          form.liberacion.trim()          || null,
    }

    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('operaciones')
      .update(updates)
      .eq('id', op.id)

    if (dbError) {
      setError(dbError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved({ ...op, ...updates })
    onClose()
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleBackdrop}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: 16 }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '0.5px solid #E8E5DE' }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', margin: 0 }}>Editar Operación</h2>
            {op.interno && (
              <p style={{ fontSize: 12, color: '#9C9A94', margin: '3px 0 0' }}>Interno #{op.interno}</p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Interno</label>
              <input type="number" value={form.interno} onChange={e => handleChange('interno', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº interno" />
            </div>

            <div>
              <label style={labelStyle}>Recep. Documentos</label>
              <input type="date" value={form.recep_doc} onChange={e => handleChange('recep_doc', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Cliente</label>
              <div style={{ position: 'relative' }}>
                <select value={form.cliente} onChange={e => handleChange('cliente', e.target.value)}
                  style={selectStyle} onFocus={onFocus} onBlur={onBlur}>
                  <option value="">— Sin cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  {form.cliente && !clientes.find(c => c.nombre === form.cliente) && (
                    <option value={form.cliente}>{form.cliente} (actual)</option>
                  )}
                </select>
                <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Transporte</label>
              <div style={{ position: 'relative' }}>
                <select value={form.transporte} onChange={e => handleChange('transporte', e.target.value)}
                  style={selectStyle} onFocus={onFocus} onBlur={onBlur}>
                  <option value="">— Sin transporte —</option>
                  {transportes.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  {form.transporte && !transportes.find(t => t.nombre === form.transporte) && (
                    <option value={form.transporte}>{form.transporte} (actual)</option>
                  )}
                </select>
                <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Factura</label>
              <input type="text" value={form.factura} onChange={e => handleChange('factura', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº factura" />
            </div>

            <div>
              <label style={labelStyle}>OC</label>
              <input type="text" value={form.oc} onChange={e => handleChange('oc', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº OC del cliente" />
            </div>

            <div>
              <label style={labelStyle}>Fecha pedido fondos</label>
              <input type="date" value={form.fecha_pedido_fondos} onChange={e => handleChange('fecha_pedido_fondos', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={labelStyle}>CRT</label>
              <input type="text" value={form.crt} onChange={e => handleChange('crt', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº CRT" />
            </div>

            <div>
              <label style={labelStyle}>SENASA</label>
              <input type="text" value={form.senasa} onChange={e => handleChange('senasa', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº SENASA" />
            </div>

            <div>
              <label style={labelStyle}>N. Despacho</label>
              <input type="text" value={form.despacho} onChange={e => handleChange('despacho', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº despacho" />
            </div>

            <div>
              <label style={labelStyle}>Oficialización</label>
              <input type="date" value={form.oficializacion} onChange={e => handleChange('oficializacion', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={labelStyle}>Aviso</label>
              <input type="date" value={form.aviso} onChange={e => handleChange('aviso', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={labelStyle}>Nota de Entrega</label>
              <input type="date" value={form.nota_entrega} onChange={e => handleChange('nota_entrega', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <div>
              <label style={labelStyle}>Liberación</label>
              <input type="date" value={form.liberacion} onChange={e => handleChange('liberacion', e.target.value)}
                style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 20, borderTop: '0.5px solid #E8E5DE' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0 16px', height: 32, fontSize: 13, border: '0.5px solid #E8E5DE', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6B6860', transition: 'background 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F5' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '0 16px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 120ms' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#27272A' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#18181B' }}>
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
