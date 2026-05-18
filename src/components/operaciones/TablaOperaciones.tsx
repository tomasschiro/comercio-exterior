'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Operacion } from '@/types/database'
import ModalNuevaOperacion from './ModalNuevaOperacion'
import PanelDetalle from './PanelDetalle'

type SenasaEstado = 'pendiente' | 'retenida' | 'liberada' | 'vinculada'
type Section = 'pendientes' | 'liberadas'
type InnerTab = 'mis' | 'todas'

type FieldType = 'text' | 'date' | 'number'
const FIELD_TYPE: Partial<Record<keyof Operacion, FieldType>> = {
  interno:             'number',
  recep_doc:           'date',
  cliente:             'text',
  factura:             'text',
  oc:                  'text',
  crt:                 'text',
  senasa:              'text',
  despacho:            'text',
  oficializacion:      'date',
  fecha_pedido_fondos: 'date',
  aviso:               'date',
  nota_entrega:        'date',
  liberacion:          'date',
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

interface CanalPopoverState {
  id: number
  canal: string | null
  top: number
  left: number
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  const [, m, day] = d.split('-')
  return `${day}/${m}`
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

function getDiasEnEtapa(op: Operacion): number {
  const dates: string[] = [
    op.nota_entrega, op.aviso, op.oficializacion,
    op.senasa, op.fecha_pedido_fondos, op.recep_doc,
  ].filter((d): d is string => typeof d === 'string' && d.length > 0)
  dates.sort()
  const ref = dates[dates.length - 1] ?? op.created_at?.split('T')[0]
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
}

function isAtrasada(op: Operacion): boolean {
  if (op.liberacion) return false
  return getDiasEnEtapa(op) > 5
}

function getStripeColor(op: Operacion): string | null {
  if (op.liberacion) return '#166534'
  if (op.senasa_estado === 'retenida') return '#991B1B'
  if (isAtrasada(op)) return '#D97706'
  return null
}

const SENASA_OPCIONES: { value: SenasaEstado; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'retenida',  label: 'Retenida'  },
  { value: 'liberada',  label: 'Liberada'  },
  { value: 'vinculada', label: 'Vinculada' },
]

const MONO: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 12,
}

const CELL_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  fontSize: 12,
  border: '2px solid #1E40AF',
  borderRadius: 4,
  outline: 'none',
  background: '#FFFFFF',
  color: '#1F1B14',
  boxShadow: '0 0 0 3px rgba(29,78,216,.12)',
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
  const [section, setSection] = useState<Section>('pendientes')
  const [innerTab, setInnerTab] = useState<InnerTab>('mis')
  const [chipAtrasadas, setChipAtrasadas] = useState(false)
  const [chipRetenidas, setChipRetenidas] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [panelOp, setPanelOp] = useState<Operacion | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [cellStates, setCellStates] = useState<Record<string, CellStatus>>({})
  const [senasaPopover, setSenasaPopover] = useState<SenasaPopoverState | null>(null)
  const [canalPopover, setCanalPopover] = useState<CanalPopoverState | null>(null)
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
      if (status === null) { const next = { ...prev }; delete next[key]; return next }
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
    if (panelOp?.id === id) setPanelOp(prev => prev ? { ...prev, [field]: parsed } : null)
    setEditing(null)
    setCellStatus(id, field, 'saving')

    const supabase = createClient()
    const { error } = await supabase.from('operaciones').update({ [field]: parsed }).eq('id', id)

    if (error) {
      setOperaciones(prev => prev.map(op => op.id === id ? { ...op, [field]: oldValue } : op))
      if (panelOp?.id === id) setPanelOp(prev => prev ? { ...prev, [field]: oldValue } : null)
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
    setSenasaPopover({ id: op.id, estado: ((op.senasa_estado as SenasaEstado) || 'pendiente'), vinculacion: op.senasa_vinculacion || '', top: rect.bottom + 4, left })
  }

  async function saveSenasaEstado() {
    if (!senasaPopover) return
    const { id, estado, vinculacion } = senasaPopover
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return
    const updates = { senasa_estado: estado, senasa_vinculacion: estado === 'vinculada' && vinculacion ? vinculacion : null }
    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, ...updates } : op))
    setSenasaPopover(null)
    const supabase = createClient()
    const { error } = await supabase.from('operaciones').update(updates).eq('id', id)
    if (error) setOperaciones(prev => prev.map(op => op.id === id ? oldOp : op))
  }

  function openCanalPopover(op: Operacion, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 130)
    setCanalPopover({ id: op.id, canal: op.canal ?? null, top: rect.bottom + 4, left })
  }

  async function saveCanalEstado() {
    if (!canalPopover) return
    const { id, canal } = canalPopover
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return
    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, canal } : op))
    setCanalPopover(null)
    const supabase = createClient()
    const { error } = await supabase.from('operaciones').update({ canal }).eq('id', id)
    if (error) setOperaciones(prev => prev.map(op => op.id === id ? oldOp : op))
  }

  async function handlePanelSave(updated: Operacion) {
    const oldOp = operaciones.find(o => o.id === updated.id)
    if (!oldOp) return

    setOperaciones(prev => prev.map(op => op.id === updated.id ? updated : op))
    setPanelOp(updated)

    const supabase = createClient()
    const { error } = await supabase
      .from('operaciones')
      .update({
        interno: updated.interno,
        recep_doc: updated.recep_doc,
        cliente: updated.cliente,
        transporte: updated.transporte,
        factura: updated.factura,
        oc: updated.oc,
        fecha_pedido_fondos: updated.fecha_pedido_fondos,
        crt: updated.crt,
        senasa: updated.senasa,
        senasa_estado: updated.senasa_estado,
        senasa_vinculacion: updated.senasa_vinculacion,
        canal: updated.canal,
        despacho: updated.despacho,
        oficializacion: updated.oficializacion,
        aviso: updated.aviso,
        nota_entrega: updated.nota_entrega,
        liberacion: updated.liberacion,
      })
      .eq('id', updated.id)

    if (error) {
      setOperaciones(prev => prev.map(op => op.id === updated.id ? oldOp : op))
      setPanelOp(oldOp)
      throw new Error(error.message)
    }
  }

  const pendientes = operaciones.filter(op => !op.liberacion)
  const liberadas  = operaciones.filter(op => !!op.liberacion)

  const base = section === 'pendientes' ? pendientes : liberadas

  const filtradas = base.filter(op => {
    if (innerTab === 'mis' && userId && op.created_by !== userId) return false
    if (chipAtrasadas && !isAtrasada(op)) return false
    if (chipRetenidas && op.senasa_estado !== 'retenida') return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return (
        op.cliente?.toLowerCase().includes(q) ||
        op.despacho?.toLowerCase().includes(q) ||
        op.crt?.toLowerCase().includes(q) ||
        op.factura?.toLowerCase().includes(q) ||
        op.oc?.toLowerCase().includes(q) ||
        String(op.interno ?? '').includes(q)
      )
    }
    return true
  })

  const atrasadasCount = base.filter(isAtrasada).length
  const retenidasCount = base.filter(op => op.senasa_estado === 'retenida').length
  const totalCols = innerTab === 'todas' ? 19 : 18  // stripe + 17/16 + action

  function renderCell(op: Operacion, field: keyof Operacion, extraStyle?: React.CSSProperties) {
    const key = `${op.id}-${field}`
    const status = cellStates[key]
    const isEditingCell = editing?.id === op.id && editing?.field === field
    const inputType = FIELD_TYPE[field] ?? 'text'

    if (isEditingCell) {
      return (
        <input
          autoFocus
          type={inputType}
          value={editing.value}
          onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); suppressBlurRef.current = true; commitEdit(editing) }
            else if (e.key === 'Escape') { e.preventDefault(); suppressBlurRef.current = true; setEditing(null) }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) { suppressBlurRef.current = false; return }
            setEditing(prev => { if (prev && prev.id === op.id && prev.field === field) { commitEdit(prev); return null } return prev })
          }}
          style={{ ...CELL_INPUT, ...(extraStyle ?? {}), minWidth: inputType === 'date' ? 110 : 60 }}
        />
      )
    }

    const displayValue = getDisplayValue(op, field)
    const isEmpty = displayValue === '—'
    let borderColor = 'transparent'
    let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5'; bgColor = 'transparent' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }

    return (
      <div
        onClick={() => startEdit(op, field)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden', ...(extraStyle ?? {}) }}
        className={!status ? 'cell-hover' : ''}
      >
        <span style={{ color: isEmpty ? '#C4B89A' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'center' }}>
          {displayValue}
        </span>
        {status === 'saving' && (
          <svg className="animate-spin" style={{ width: 10, height: 10, color: '#7A7158', flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    )
  }

  function renderCellLeft(op: Operacion, field: keyof Operacion) {
    const key = `${op.id}-${field}`
    const status = cellStates[key]
    const isEditingCell = editing?.id === op.id && editing?.field === field
    const inputType = FIELD_TYPE[field] ?? 'text'

    if (isEditingCell) {
      return (
        <input
          autoFocus
          type={inputType}
          value={editing.value}
          onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); suppressBlurRef.current = true; commitEdit(editing) }
            else if (e.key === 'Escape') { e.preventDefault(); suppressBlurRef.current = true; setEditing(null) }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) { suppressBlurRef.current = false; return }
            setEditing(prev => { if (prev && prev.id === op.id && prev.field === field) { commitEdit(prev); return null } return prev })
          }}
          style={{ ...CELL_INPUT, minWidth: 80 }}
        />
      )
    }

    const displayValue = getDisplayValue(op, field)
    const isEmpty = displayValue === '—'
    let borderColor = 'transparent'
    let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5'; bgColor = 'transparent' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }

    return (
      <div
        onClick={() => startEdit(op, field)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden' }}
        className={!status ? 'cell-hover' : ''}
      >
        <span style={{ color: isEmpty ? '#C4B89A' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          {displayValue}
        </span>
        {status === 'saving' && (
          <svg className="animate-spin" style={{ width: 10, height: 10, color: '#7A7158', flexShrink: 0 }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>
    )
  }

  function renderSenasaCell(op: Operacion) {
    const estado = (op.senasa_estado as SenasaEstado) || 'pendiente'
    const vinculacion = op.senasa_vinculacion
    let badge: React.ReactNode
    if (!estado || estado === 'pendiente') {
      badge = <span style={{ color: '#C4B89A' }}>—</span>
    } else if (estado === 'retenida') {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#FBDDD4', color: '#991B1B' }}>Retenida</span>
    } else if (estado === 'liberada') {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#E1F1D6', color: '#166534' }}>Liberada</span>
    } else {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 6px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#E0E4FB', color: '#3730A3' }}>Vinc.{vinculacion ? ` ${formatDateShort(vinculacion)}` : ''}</span>
    }
    return (
      <div onClick={e => openSenasaPopover(op, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'pointer', minHeight: 20, transition: 'background 80ms' }} className="cell-hover">
        {badge}
      </div>
    )
  }

  function renderCanalCell(op: Operacion) {
    const canal = op.canal
    const CANAL_MAP: Record<string, { label: string; bg: string; color: string }> = {
      V: { label: 'Verde',   bg: '#E1F1D6', color: '#166534' },
      R: { label: 'Rojo',    bg: '#FBDDD4', color: '#991B1B' },
      N: { label: 'Naranja', bg: '#FDE6CB', color: '#9A3412' },
      A: { label: 'Amarillo',bg: '#FCEBC4', color: '#92400E' },
    }
    const badge = canal && CANAL_MAP[canal]
      ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: CANAL_MAP[canal].bg, color: CANAL_MAP[canal].color }}>{CANAL_MAP[canal].label}</span>
      : <span style={{ color: '#C4B89A' }}>—</span>
    return (
      <div onClick={e => openCanalPopover(op, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'pointer', minHeight: 20, transition: 'background 80ms' }} className="cell-hover">
        {badge}
      </div>
    )
  }

  const TH: React.CSSProperties = {
    textAlign: 'center', padding: '0 6px 10px', fontSize: 10.5, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7A7158',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  }
  const THL: React.CSSProperties = { ...TH, textAlign: 'left' }

  return (
    <>
      <style>{`
        .cell-hover:hover { background: rgba(31,27,20,.05); }
        .row-h:hover { background: #FBF7E8 !important; }
        .row-h:hover .act-btn { opacity: 1 !important; }
        .act-btn:hover { background: rgba(31,27,20,.07) !important; color: #1F1B14 !important; }
        .st-interno  { position: sticky; left: 4px;   background: #FFFFFF; z-index: 2; }
        .st-cliente  { position: sticky; left: 126px; background: #FFFFFF; z-index: 2; }
        .st-action   { position: sticky; right: 0px;  background: #FFFFFF; z-index: 2; }
        .row-h:hover .st-interno  { background: #FBF7E8; }
        .row-h:hover .st-cliente  { background: #FBF7E8; }
        .row-h:hover .st-action   { background: #FBF7E8; }
        th.st-interno { background: #FFFFFF; z-index: 3; }
        th.st-cliente { background: #FFFFFF; z-index: 3; }
        th.st-action  { background: #FFFFFF; z-index: 3; }
        .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 12; font-weight: 500; border: 1px solid transparent; cursor: pointer; transition: background 100ms, border-color 100ms; }
        .chip-off { background: transparent; border-color: #E8DFC5; color: #7A7158; }
        .chip-off:hover { background: #F2ECDC; }
        .chip-warn { background: #FCEBC4; border-color: #E8DFC5; color: #92400E; }
        .chip-bad  { background: #FBDDD4; border-color: #E8DFC5; color: #991B1B; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1F1B14', margin: 0, letterSpacing: '-0.01em' }}>Operaciones</h1>
            <p style={{ fontSize: 13, color: '#7A7158', margin: '4px 0 0' }}>
              {loading ? 'Cargando...' : (
                section === 'pendientes'
                  ? `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}${atrasadasCount ? ` · ${atrasadasCount} atrasada${atrasadasCount !== 1 ? 's' : ''}` : ''}${retenidasCount ? ` · ${retenidasCount} retenida${retenidasCount !== 1 ? 's' : ''} en SENASA` : ''}`
                  : `${liberadas.length} liberada${liberadas.length !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 34, fontSize: 13, fontWeight: 500, color: '#4A4332', background: 'transparent', border: '1px solid #E8DFC5', borderRadius: 6, cursor: 'pointer', transition: 'background 120ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F2ECDC' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 34, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: '#1F1B14', border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'background 120ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#111008' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1F1B14' }}
            >
              <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nueva operación
            </button>
          </div>
        </div>

        {/* Section tabs: Pendientes | Liberadas */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E8DFC5' }}>
          {([
            { key: 'pendientes', label: 'Pendientes de liberación', count: pendientes.length },
            { key: 'liberadas',  label: 'Liberadas',                count: liberadas.length  },
          ] as { key: Section; label: string; count: number }[]).map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: section === s.key ? 600 : 400,
                border: 'none', background: 'none', cursor: 'pointer',
                color: section === s.key ? '#1F1B14' : '#7A7158',
                borderBottom: section === s.key ? '2px solid #1F1B14' : '2px solid transparent',
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                transition: 'color 100ms',
              }}
            >
              {s.label}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, padding: '0 5px', height: 18, borderRadius: 100, fontSize: 11, fontWeight: 500, background: section === s.key ? '#E8DFC5' : '#F2ECDC', color: section === s.key ? '#4A4332' : '#ADA482' }}>
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Mis / Todas segmented */}
            <div style={{ display: 'flex', gap: 2, background: '#F2ECDC', borderRadius: 8, padding: 3, border: '1px solid #E8DFC5' }}>
              {(['mis', 'todas'] as InnerTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setInnerTab(t)}
                  style={{ padding: '3px 10px', fontSize: 12, fontWeight: 500, borderRadius: 5, border: 'none', cursor: 'pointer', transition: 'background 100ms', background: innerTab === t ? '#FFFFFF' : 'transparent', color: innerTab === t ? '#1F1B14' : '#4A4332', boxShadow: innerTab === t ? '0 1px 2px rgba(31,27,20,.08)' : 'none' }}
                >
                  {t === 'mis' ? 'Mis operaciones' : 'Todas'}
                </button>
              ))}
            </div>

            {/* Filter chips — only in pendientes */}
            {section === 'pendientes' && (
              <>
                <button
                  onClick={() => setChipAtrasadas(v => !v)}
                  className={`chip ${chipAtrasadas ? 'chip-warn' : 'chip-off'}`}
                  aria-pressed={chipAtrasadas}
                >
                  {chipAtrasadas && (
                    <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Atrasadas{atrasadasCount > 0 && ` (${atrasadasCount})`}
                </button>
                <button
                  onClick={() => setChipRetenidas(v => !v)}
                  className={`chip ${chipRetenidas ? 'chip-bad' : 'chip-off'}`}
                  aria-pressed={chipRetenidas}
                >
                  {chipRetenidas && (
                    <svg style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  Retenidas SENASA{retenidasCount > 0 && ` (${retenidasCount})`}
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#7A7158', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 12, height: 32, fontSize: 13, border: '1px solid #E8DFC5', borderRadius: 6, outline: 'none', width: 200, background: '#FFFFFF', color: '#1F1B14' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E8DFC5'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={cargarOperaciones}
              title="Actualizar"
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E8DFC5', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#7A7158', transition: 'color 100ms, background 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1F1B14'; e.currentTarget.style.background = '#F2ECDC' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7A7158'; e.currentTarget.style.background = 'transparent' }}
            >
              <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FBDDD4', border: '1px solid #F9C7BB', borderRadius: 6, fontSize: 13, color: '#991B1B' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Table card */}
        <div style={{ border: '1px solid #E8DFC5', borderRadius: 10, boxShadow: '0 1px 0 rgba(31,27,20,.04), 0 1px 2px rgba(31,27,20,.05)', overflow: 'hidden', background: '#FFFFFF' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#1F1B14', tableLayout: 'fixed', minWidth: 1180 }}>
              <colgroup>
                <col style={{ width: 4 }} />    {/* stripe */}
                <col style={{ width: 62 }} />   {/* interno */}
                <col style={{ width: 60 }} />   {/* recep */}
                <col style={{ width: 156 }} />  {/* cliente */}
                <col style={{ width: 66 }} />   {/* oc */}
                <col style={{ width: 86 }} />   {/* factura */}
                <col style={{ width: 82 }} />   {/* crt */}
                <col style={{ width: 60 }} />   {/* ped. $ */}
                <col style={{ width: 64 }} />   {/* senasa */}
                <col style={{ width: 100 }} />  {/* est. senasa */}
                <col style={{ width: 60 }} />   {/* ofic */}
                <col style={{ width: 98 }} />   {/* despacho */}
                <col style={{ width: 78 }} />   {/* canal */}
                <col style={{ width: 60 }} />   {/* aviso */}
                <col style={{ width: 68 }} />   {/* nota ent */}
                <col style={{ width: 76 }} />   {/* liberacion */}
                {innerTab === 'todas' && <col style={{ width: 90 }} />}
                <col style={{ width: 32 }} />   {/* action */}
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8DFC5' }}>
                  <th style={{ padding: 0, width: 4 }} />
                  <th style={{ ...TH, textAlign: 'left', paddingLeft: 8 }} className="st-interno">Inter.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Recepción de documentos">Recep.</th>
                  <th style={THL} className="st-cliente">Cliente</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Orden de compra del cliente">OC</th>
                  <th style={TH}>Factura</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Carta de porte internacional">CRT</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Pedido de fondos">Ped. $</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Número SENASA">SENASA</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Estado SENASA">Est. SENASA</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Fecha de oficialización">Ofic.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Número de despacho">Despacho</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Canal aduanero">Canal</th>
                  <th style={TH}>Aviso</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Nota de entrega">Nota Ent.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Fecha de liberación">Liberación</th>
                  {innerTab === 'todas' && <th style={THL}>Cargado por</th>}
                  <th style={{ width: 32, padding: '0 4px 10px' }} className="st-action" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={totalCols} style={{ padding: '48px 16px', textAlign: 'center', color: '#7A7158' }}>
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
                        <svg style={{ width: 32, height: 32, color: '#E8DFC5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p style={{ fontSize: 13, color: '#7A7158', margin: 0 }}>
                          {busqueda || chipAtrasadas || chipRetenidas
                            ? `No hay operaciones ${section} con esos filtros.`
                            : section === 'pendientes'
                            ? 'No hay operaciones pendientes.'
                            : 'No hay operaciones liberadas.'}
                        </p>
                        {!busqueda && !chipAtrasadas && !chipRetenidas && section === 'pendientes' && (
                          <button onClick={() => setModalOpen(true)} style={{ marginTop: 4, fontSize: 13, color: '#1F1B14', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                            + Nueva operación
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtradas.map(op => {
                    const stripe = getStripeColor(op)
                    const atrasada = isAtrasada(op)
                    const dias = getDiasEnEtapa(op)

                    return (
                      <tr key={op.id} className="row-h" style={{ borderBottom: '1px solid #E8DFC5', height: 36 }}>

                        {/* Stripe */}
                        <td style={{ padding: 0, width: 4 }}>
                          {stripe && (
                            <div style={{ width: 2, height: 26, borderRadius: 99, background: stripe, margin: '0 auto' }} />
                          )}
                        </td>

                        {/* Interno */}
                        <td style={{ padding: '0 4px 0 8px', overflow: 'hidden' }} className="st-interno">
                          <div style={{ fontWeight: 600, color: atrasada ? '#991B1B' : '#1D4ED8', ...MONO }}>
                            {renderCell(op, 'interno', { ...MONO, textAlign: 'left', justifyContent: 'flex-start' })}
                          </div>
                          {atrasada && (
                            <div style={{ fontSize: 10, color: '#D97706', marginTop: 1 }} title={`${dias} días sin avance`}>
                              {dias}d
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'recep_doc')}
                        </td>

                        {/* Cliente */}
                        <td style={{ padding: '0 4px', overflow: 'hidden' }} className="st-cliente">
                          {renderCellLeft(op, 'cliente')}
                        </td>

                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', ...MONO, color: '#7A7158' }}>
                          {renderCell(op, 'oc', MONO)}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', ...MONO, color: '#7A7158' }}>
                          {renderCell(op, 'factura', MONO)}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', ...MONO, color: '#7A7158' }}>
                          {renderCell(op, 'crt', MONO)}
                        </td>
                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'fecha_pedido_fondos')}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', ...MONO, color: '#7A7158' }}>
                          {renderCell(op, 'senasa', MONO)}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center' }}>
                          {renderSenasaCell(op)}
                        </td>
                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'oficializacion')}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', ...MONO, color: '#7A7158' }}>
                          {renderCell(op, 'despacho', MONO)}
                        </td>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCanalCell(op)}
                        </td>
                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'aviso')}
                        </td>
                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'nota_entrega')}
                        </td>
                        <td style={{ padding: '0 4px', color: '#7A7158', overflow: 'hidden', textAlign: 'center' }}>
                          {renderCell(op, 'liberacion')}
                        </td>

                        {innerTab === 'todas' && (
                          <td style={{ padding: '0 4px', color: '#ADA482', overflow: 'hidden', fontSize: 11, textAlign: 'left' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {op.created_by_email ?? '—'}
                            </span>
                          </td>
                        )}

                        {/* Action: open detail */}
                        <td style={{ padding: '0 2px', overflow: 'hidden', textAlign: 'center' }} className="st-action">
                          <button
                            onClick={() => setPanelOp(op)}
                            title="Ver detalle"
                            className="act-btn"
                            style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#7A7158', borderRadius: 4, display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 100ms, background 100ms' }}
                          >
                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
        </div>
      </div>

      {/* SENASA Popover */}
      {senasaPopover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setSenasaPopover(null)} />
          <div style={{ position: 'fixed', top: senasaPopover.top, left: senasaPopover.left, zIndex: 50, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 6, width: 168 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SENASA_OPCIONES.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setSenasaPopover(prev => prev ? { ...prev, estado: opt.value } : null)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 80ms', background: senasaPopover.estado === opt.value ? '#1F1B14' : 'transparent', color: senasaPopover.estado === opt.value ? '#FFFFFF' : '#1F1B14', fontWeight: senasaPopover.estado === opt.value ? 500 : 400 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {senasaPopover.estado === 'vinculada' && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E8DFC5' }}>
                <input type="date" value={senasaPopover.vinculacion}
                  onChange={e => setSenasaPopover(prev => prev ? { ...prev, vinculacion: e.target.value } : null)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #E8DFC5', borderRadius: 4, outline: 'none', color: '#1F1B14' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E8DFC5'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, paddingTop: 8, borderTop: '1px solid #E8DFC5' }}>
              <button type="button" onClick={saveSenasaEstado}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#FFFFFF', background: '#1F1B14', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111008' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1F1B14' }}
              >Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* Canal Popover */}
      {canalPopover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCanalPopover(null)} />
          <div style={{ position: 'fixed', top: canalPopover.top, left: canalPopover.left, zIndex: 50, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 6, width: 120 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {([null, 'V', 'R', 'N', 'A'] as const).map(val => {
                const labels: Record<string, string> = { V: 'Verde', R: 'Rojo', N: 'Naranja', A: 'Amarillo' }
                const isSelected = canalPopover.canal === val
                return (
                  <button key={val ?? 'none'} type="button"
                    onClick={() => setCanalPopover(prev => prev ? { ...prev, canal: val } : null)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 80ms', background: isSelected ? '#1F1B14' : 'transparent', color: isSelected ? '#FFFFFF' : '#1F1B14', fontWeight: isSelected ? 500 : 400 }}
                  >
                    {val === null ? '—' : labels[val]}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, paddingTop: 8, borderTop: '1px solid #E8DFC5' }}>
              <button type="button" onClick={saveCanalEstado}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#FFFFFF', background: '#1F1B14', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111008' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#1F1B14' }}
              >Guardar</button>
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

      {panelOp && (
        <PanelDetalle
          op={panelOp}
          onClose={() => setPanelOp(null)}
          onSave={handlePanelSave}
        />
      )}
    </>
  )
}
