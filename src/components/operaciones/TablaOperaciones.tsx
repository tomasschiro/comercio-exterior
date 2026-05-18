'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Operacion } from '@/types/database'
import ModalNuevaOperacion from './ModalNuevaOperacion'
import ModalEditarOperacion from './ModalEditarOperacion'

type SenasaEstado = 'pendiente' | 'retenida' | 'liberada' | 'vinculada'
type Tab = 'mis' | 'todas'

const PROGRESS_FIELDS: Array<keyof Operacion> = [
  'interno', 'recep_doc', 'cliente', 'crt', 'senasa',
  'despacho', 'oficializacion', 'aviso', 'nota_entrega', 'liberacion',
]

type FieldType = 'text' | 'date' | 'number'
const FIELD_TYPE: Partial<Record<keyof Operacion, FieldType>> = {
  interno:        'number',
  recep_doc:      'date',
  cliente:        'text',
  crt:            'text',
  senasa:         'text',
  despacho:       'text',
  oficializacion: 'date',
  aviso:          'date',
  nota_entrega:   'date',
  liberacion:     'date',
}

type CellStatus = 'saving' | 'success' | 'error'
type EditingCell = { id: number; field: keyof Operacion; value: string }

interface SenasaPopoverState {
  id: number
  estado: SenasaEstado
  vinculacion: string
  top: number
  left: number
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatDateShort(d: string | null): string {
  if (!d) return ''
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function getRawValue(op: Operacion, field: keyof Operacion): string {
  const v = op[field]
  return v !== null && v !== undefined ? String(v) : ''
}

function getDisplayValue(op: Operacion, field: keyof Operacion): string {
  const type = FIELD_TYPE[field]
  if (type === 'date') return formatDate(op[field] as string | null)
  const v = op[field]
  return v !== null && v !== undefined && v !== '' ? String(v) : '—'
}

function getEstado(op: Operacion): 'Pendiente' | 'En proceso' | 'Liberado' {
  if (op.liberacion) return 'Liberado'
  const hasData = [
    op.recep_doc, op.cliente, op.crt, op.senasa,
    op.despacho, op.oficializacion, op.aviso, op.nota_entrega,
  ].some(Boolean)
  return hasData ? 'En proceso' : 'Pendiente'
}

function countDone(op: Operacion): number {
  return PROGRESS_FIELDS.filter(f => {
    const v = op[f]
    return v !== null && v !== undefined && v !== ''
  }).length
}

const SENASA_OPCIONES: { value: SenasaEstado; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'retenida',  label: 'Retenida'  },
  { value: 'liberada',  label: 'Liberada'  },
  { value: 'vinculada', label: 'Vinculada' },
]

const MONO_STYLE = { fontFamily: 'var(--font-geist-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: 12 }

// Shared input style for inline cell editing
const CELL_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '3px 6px',
  fontSize: 13,
  border: '0.5px solid #18181B',
  borderRadius: 4,
  outline: 'none',
  background: '#FFFFFF',
  color: '#0D0D0D',
  boxShadow: '0 0 0 3px rgba(0,0,0,0.06)',
}

interface Props {
  userEmail?: string
  userId?: string
  userRol?: string
}

export default function TablaOperaciones({ userEmail, userId }: Props) {
  const [operaciones, setOperaciones] = useState<Operacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('mis')
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOp, setEditModalOp] = useState<Operacion | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [cellStates, setCellStates] = useState<Record<string, CellStatus>>({})
  const [senasaPopover, setSenasaPopover] = useState<SenasaPopoverState | null>(null)
  const suppressBlurRef = useRef(false)

  const cargarOperaciones = useCallback(async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('operaciones')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setOperaciones(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { cargarOperaciones() }, [cargarOperaciones])

  function setCellStatus(id: number, field: string, status: CellStatus | null) {
    const key = `${id}-${field}`
    setCellStates(prev => {
      if (status === null) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: status }
    })
  }

  function startEdit(op: Operacion, field: keyof Operacion) {
    const key = `${op.id}-${field}`
    if (cellStates[key] === 'saving') return
    setEditing({ id: op.id, field, value: getRawValue(op, field) })
  }

  async function commitEdit(cell: EditingCell) {
    const { id, field, value } = cell
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return

    const oldValue = oldOp[field]
    let parsed: string | number | null
    if (value.trim() === '') {
      parsed = null
    } else if (field === 'interno') {
      parsed = parseInt(value) || null
    } else {
      parsed = value.trim()
    }

    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, [field]: parsed } : op))
    setEditing(null)
    setCellStatus(id, field, 'saving')

    const supabase = createClient()
    const { error } = await supabase
      .from('operaciones')
      .update({ [field]: parsed })
      .eq('id', id)

    if (error) {
      setOperaciones(prev => prev.map(op => op.id === id ? { ...op, [field]: oldValue } : op))
      setCellStatus(id, field, 'error')
      setTimeout(() => setCellStatus(id, field, null), 1200)
    } else {
      setCellStatus(id, field, 'success')
      setTimeout(() => setCellStatus(id, field, null), 1200)
    }
  }

  function openSenasaPopover(op: Operacion, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 196)
    setSenasaPopover({
      id: op.id,
      estado: ((op.senasa_estado as SenasaEstado) || 'pendiente'),
      vinculacion: op.senasa_vinculacion || '',
      top: rect.bottom + 4,
      left,
    })
  }

  async function saveSenasaEstado() {
    if (!senasaPopover) return
    const { id, estado, vinculacion } = senasaPopover
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return

    const updates = {
      senasa_estado: estado,
      senasa_vinculacion: estado === 'vinculada' && vinculacion ? vinculacion : null,
    }

    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, ...updates } : op))
    setSenasaPopover(null)

    const supabase = createClient()
    const { error } = await supabase
      .from('operaciones')
      .update(updates)
      .eq('id', id)

    if (error) {
      setOperaciones(prev => prev.map(op => op.id === id ? oldOp : op))
    }
  }

  function handleEditModalSaved(updated: Operacion) {
    setOperaciones(prev => prev.map(op => op.id === updated.id ? updated : op))
  }

  const filtradas = operaciones.filter(op => {
    if (tab === 'mis' && userId && op.created_by !== userId) return false
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

  const totalCols = tab === 'todas' ? 14 : 13

  function renderCell(op: Operacion, field: keyof Operacion, extraStyle?: React.CSSProperties) {
    const key = `${op.id}-${field}`
    const status = cellStates[key]
    const isEditing = editing?.id === op.id && editing?.field === field
    const inputType = FIELD_TYPE[field] ?? 'text'

    if (isEditing) {
      return (
        <input
          autoFocus
          type={inputType}
          value={editing.value}
          onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              suppressBlurRef.current = true
              commitEdit(editing)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              suppressBlurRef.current = true
              setEditing(null)
            }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) {
              suppressBlurRef.current = false
              return
            }
            setEditing(prev => {
              if (prev && prev.id === op.id && prev.field === field) {
                commitEdit(prev)
                return null
              }
              return prev
            })
          }}
          style={{
            ...CELL_INPUT_STYLE,
            ...(extraStyle ?? {}),
            minWidth: inputType === 'date' ? 130 : 72,
          }}
        />
      )
    }

    const displayValue = getDisplayValue(op, field)
    const isEmpty = displayValue === '—'

    let borderColor = 'transparent'
    let bgColor = 'transparent'
    if (status === 'saving') { borderColor = '#E8E5DE'; bgColor = 'transparent' }
    if (status === 'success') { borderColor = '#16A34A'; bgColor = '#DCFCE7' }
    if (status === 'error')   { borderColor = '#DC2626'; bgColor = '#FEF2F2' }

    return (
      <div
        onClick={() => startEdit(op, field)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderRadius: 4,
          padding: '2px 4px',
          margin: '0 -4px',
          cursor: 'text',
          minHeight: 22,
          border: status ? `0.5px solid ${borderColor}` : 'none',
          background: bgColor,
          transition: 'background 80ms',
          ...(extraStyle ?? {}),
        }}
        className={!status ? 'cell-hover' : ''}
      >
        <span
          className="truncate"
          style={{
            color: isEmpty ? '#D4D4D4' : undefined,
            fontSize: 'inherit',
          }}
        >
          {displayValue}
        </span>
        {status === 'saving' && (
          <svg className="animate-spin" style={{ width: 11, height: 11, color: '#9C9A94', flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    )
  }

  function renderSenasaEstadoCell(op: Operacion) {
    const estado = (op.senasa_estado as SenasaEstado) || 'pendiente'
    const vinculacion = op.senasa_vinculacion

    let badge: React.ReactNode
    if (!estado || estado === 'pendiente') {
      badge = <span style={{ color: '#D4D4D4' }}>—</span>
    } else if (estado === 'retenida') {
      badge = (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: '#FEF3C7', color: '#D97706' }}>
          Retenida
        </span>
      )
    } else if (estado === 'liberada') {
      badge = (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: '#DCFCE7', color: '#16A34A' }}>
          Liberada
        </span>
      )
    } else {
      badge = (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: '#EFF6FF', color: '#2563EB' }}>
          Vinculada{vinculacion ? ` ${formatDateShort(vinculacion)}` : ''}
        </span>
      )
    }

    return (
      <div
        onClick={e => openSenasaPopover(op, e)}
        style={{ display: 'flex', alignItems: 'center', borderRadius: 4, padding: '2px 4px', margin: '0 -4px', cursor: 'pointer', minHeight: 22, transition: 'background 80ms' }}
        className="cell-hover"
      >
        {badge}
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0 16px 10px',
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#9C9A94',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      <style>{`.cell-hover:hover { background: rgba(0,0,0,0.04); }`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', margin: 0, letterSpacing: '-0.01em' }}>
                Operaciones
              </h1>
              <p style={{ fontSize: 12, color: '#9C9A94', margin: '2px 0 0' }}>
                {loading ? 'Cargando...' : `${filtradas.length} registro${filtradas.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: '#F4F4F5', borderRadius: 8, padding: 3 }}>
              {(['mis', 'todas'] as Tab[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 100ms, color 100ms',
                    background: tab === t ? '#FFFFFF' : 'transparent',
                    color: tab === t ? '#0D0D0D' : '#6B6860',
                    boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {t === 'mis' ? 'Mis operaciones' : 'Todas'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{
                  paddingLeft: 30,
                  paddingRight: 12,
                  height: 32,
                  fontSize: 13,
                  border: '0.5px solid #E8E5DE',
                  borderRadius: 6,
                  outline: 'none',
                  width: 200,
                  background: '#FFFFFF',
                  color: '#0D0D0D',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#18181B'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E8E5DE'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={cargarOperaciones}
              title="Actualizar"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '0.5px solid #E8E5DE',
                borderRadius: 6,
                background: 'transparent',
                cursor: 'pointer',
                color: '#9C9A94',
                transition: 'color 100ms, background 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0D0D0D'; e.currentTarget.style.background = '#F4F4F5' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9C9A94'; e.currentTarget.style.background = 'transparent' }}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* New operation */}
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                height: 32,
                fontSize: 13,
                fontWeight: 500,
                color: '#FFFFFF',
                background: '#18181B',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 120ms',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#27272A' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#18181B' }}
            >
              <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nueva operación
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Table — directly on background, no card wrapper */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#0D0D0D' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #E8E5DE' }}>
                <th style={thStyle}>Interno</th>
                <th style={thStyle}>Recep. Doc</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>CRT</th>
                <th style={thStyle}>SENASA</th>
                <th style={thStyle}>Est. SENASA</th>
                <th style={thStyle}>Oficialización</th>
                <th style={thStyle}>N. Despacho</th>
                <th style={thStyle}>Aviso</th>
                <th style={thStyle}>Nota entrega</th>
                <th style={thStyle}>Liberación</th>
                {tab === 'todas' && <th style={thStyle}>Cargado por</th>}
                <th style={thStyle}>Estado</th>
                <th style={{ width: 40, padding: '0 8px 10px' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={totalCols} style={{ padding: '48px 16px', textAlign: 'center', color: '#9C9A94' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg className="animate-spin" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cargando operaciones...
                    </div>
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} style={{ padding: '64px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <svg style={{ width: 32, height: 32, color: '#E8E5DE' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p style={{ fontSize: 13, color: '#9C9A94', margin: 0 }}>
                        {busqueda ? 'Sin resultados para la búsqueda' : 'No hay operaciones cargadas aún'}
                      </p>
                      {!busqueda && (
                        <button
                          onClick={() => setModalOpen(true)}
                          style={{ marginTop: 4, fontSize: 13, color: '#18181B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}
                        >
                          + Nueva operación
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtradas.map(op => {
                  const done = countDone(op)
                  const pct = (done / 10) * 100
                  const estado = getEstado(op)

                  const estadoStyle: React.CSSProperties = estado === 'Liberado'
                    ? { background: '#DCFCE7', color: '#16A34A' }
                    : estado === 'En proceso'
                    ? { background: '#EFF6FF', color: '#2563EB' }
                    : { background: '#FEF3C7', color: '#D97706' }

                  return (
                    <tr
                      key={op.id}
                      className="table-row-hover"
                      style={{ borderBottom: '0.5px solid #E8E5DE', height: 44 }}
                    >
                      {/* Interno + progress */}
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap', minWidth: 90 }}>
                        <div style={{ fontWeight: 500, ...MONO_STYLE }}>
                          {renderCell(op, 'interno', MONO_STYLE)}
                        </div>
                        <div
                          style={{ height: 2, width: '100%', background: '#E8E5DE', borderRadius: 99, marginTop: 4 }}
                          title={`${done} de 10 completados`}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 99,
                              width: `${pct}%`,
                              background: pct === 100 ? '#16A34A' : pct > 0 ? '#2563EB' : 'transparent',
                              transition: 'width 400ms',
                            }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '0 16px', color: '#6B6860', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderCell(op, 'recep_doc')}
                      </td>
                      <td style={{ padding: '0 16px', maxWidth: 200 }}>
                        {renderCell(op, 'cliente')}
                      </td>
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap', minWidth: 96, ...MONO_STYLE, color: '#6B6860' }}>
                        {renderCell(op, 'crt', MONO_STYLE)}
                      </td>
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap', minWidth: 96, ...MONO_STYLE, color: '#6B6860' }}>
                        {renderCell(op, 'senasa', MONO_STYLE)}
                      </td>

                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderSenasaEstadoCell(op)}
                      </td>

                      <td style={{ padding: '0 16px', color: '#6B6860', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderCell(op, 'oficializacion')}
                      </td>
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap', minWidth: 108, ...MONO_STYLE, color: '#6B6860' }}>
                        {renderCell(op, 'despacho', MONO_STYLE)}
                      </td>
                      <td style={{ padding: '0 16px', color: '#6B6860', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderCell(op, 'aviso')}
                      </td>
                      <td style={{ padding: '0 16px', color: '#6B6860', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderCell(op, 'nota_entrega')}
                      </td>
                      <td style={{ padding: '0 16px', color: '#6B6860', whiteSpace: 'nowrap', minWidth: 110 }}>
                        {renderCell(op, 'liberacion')}
                      </td>

                      {tab === 'todas' && (
                        <td style={{ padding: '0 16px', color: '#9C9A94', whiteSpace: 'nowrap', minWidth: 140, fontSize: 12 }}>
                          {op.created_by_email ?? '—'}
                        </td>
                      )}

                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, ...estadoStyle }}>
                          {estado}
                        </span>
                      </td>

                      <td style={{ padding: '0 8px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setEditModalOp(op)}
                          title="Editar"
                          className="edit-btn"
                          style={{
                            padding: 6,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#9C9A94',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            opacity: 0,
                            transition: 'opacity 100ms, background 100ms',
                          }}
                        >
                          <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Row hover + edit button visibility via CSS */}
        <style>{`
          .table-row-hover:hover { background: #FAFAF8; }
          .table-row-hover:hover .edit-btn { opacity: 1 !important; }
          .edit-btn:hover { background: #F4F4F5 !important; color: #0D0D0D !important; }
        `}</style>
      </div>

      {/* SENASA Popover */}
      {senasaPopover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setSenasaPopover(null)} />
          <div
            style={{
              position: 'fixed',
              top: senasaPopover.top,
              left: senasaPopover.left,
              zIndex: 50,
              background: '#FFFFFF',
              border: '0.5px solid #E8E5DE',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              padding: 6,
              width: 168,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SENASA_OPCIONES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSenasaPopover(prev => prev ? { ...prev, estado: opt.value } : null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: 13,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 80ms',
                    background: senasaPopover.estado === opt.value ? '#18181B' : 'transparent',
                    color: senasaPopover.estado === opt.value ? '#FFFFFF' : '#0D0D0D',
                    fontWeight: senasaPopover.estado === opt.value ? 500 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {senasaPopover.estado === 'vinculada' && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #E8E5DE' }}>
                <input
                  type="date"
                  value={senasaPopover.vinculacion}
                  onChange={e => setSenasaPopover(prev => prev ? { ...prev, vinculacion: e.target.value } : null)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: 12,
                    border: '0.5px solid #E8E5DE',
                    borderRadius: 4,
                    outline: 'none',
                    color: '#0D0D0D',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#18181B'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E8E5DE'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #E8E5DE' }}>
              <button
                type="button"
                onClick={saveSenasaEstado}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  background: '#18181B',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#27272A' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#18181B' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </>
      )}

      <ModalNuevaOperacion
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={cargarOperaciones}
        userEmail={userEmail}
      />

      {editModalOp && (
        <ModalEditarOperacion
          op={editModalOp}
          onClose={() => setEditModalOp(null)}
          onSaved={updated => {
            handleEditModalSaved(updated)
            setEditModalOp(null)
          }}
        />
      )}
    </>
  )
}
