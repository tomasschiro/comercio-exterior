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
  id: number; estado: SenasaEstado; vinculacion: string; top: number; left: number
}
const PAGE_SIZE = 15
const SURFACE = '#FFFFFF'
const PAGE_BG = '#FAF9F6'
const ROW_HOVER = '#F5F2EE'

function getTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins === 1) return 'hace 1 min'
  return `hace ${mins} min`
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
  return getDiasEnEtapa(op) > 10
}


const SENASA_OPCIONES: { value: SenasaEstado; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'retenida',  label: 'Retenida'  },
  { value: 'liberada',  label: 'Liberada'  },
  { value: 'vinculada', label: 'Vinculada' },
]

const MONO: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 13,
  fontWeight: 400,
}

const CELL_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  fontSize: 12,
  border: '2px solid #1E40AF',
  borderRadius: 4,
  outline: 'none',
  background: SURFACE,
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
  const [canalPopover, setCanalPopover] = useState<{ id: number; top: number; left: number } | null>(null)
  const [transporteEditing, setTransporteEditing] = useState<number | null>(null)
  const [transporteNombres, setTransporteNombres] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loadedAt, setLoadedAt] = useState<Date>(new Date())
  const [timeAgoStr, setTimeAgoStr] = useState('hace un momento')
  const suppressBlurRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const cargarOperaciones = useCallback(async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('operaciones')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setOperaciones(data || [])
      const now = new Date()
      setLoadedAt(now)
      setTimeAgoStr(getTimeAgo(now))
    }
    setLoading(false)
  }, [])

  useEffect(() => { cargarOperaciones() }, [cargarOperaciones])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('transportes').select('nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setTransporteNombres((data ?? []).map((t: { nombre: string }) => t.nombre)))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTimeAgoStr(getTimeAgo(loadedAt)), 60000)
    return () => clearInterval(interval)
  }, [loadedAt])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (!isInput) {
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setModalOpen(true) }
        if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      }
      if (e.key === 'Escape') { searchRef.current?.blur() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { setPage(1) }, [section, innerTab, chipAtrasadas, chipRetenidas, busqueda])


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
    if (value.trim() === '') { parsed = null }
    else if (field === 'interno') { parsed = parseInt(value) || null }
    else { parsed = value.trim() }
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

  async function handlePanelSave(updated: Operacion) {
    const oldOp = operaciones.find(o => o.id === updated.id)
    if (!oldOp) return
    setOperaciones(prev => prev.map(op => op.id === updated.id ? updated : op))
    setPanelOp(updated)
    const supabase = createClient()
    const { error } = await supabase.from('operaciones').update({
      interno: updated.interno, recep_doc: updated.recep_doc, cliente: updated.cliente,
      transporte: updated.transporte, factura: updated.factura, oc: updated.oc,
      fecha_pedido_fondos: updated.fecha_pedido_fondos, crt: updated.crt,
      senasa: updated.senasa, senasa_estado: updated.senasa_estado,
      senasa_vinculacion: updated.senasa_vinculacion, canal: updated.canal,
      despacho: updated.despacho, oficializacion: updated.oficializacion,
      aviso: updated.aviso, nota_entrega: updated.nota_entrega, liberacion: updated.liberacion,
    }).eq('id', updated.id)
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

  const misCount = userId ? base.filter(op => op.created_by === userId).length : 0
  const atrasadasCount = base.filter(isAtrasada).length
  const retenidasCount = base.filter(op => op.senasa_estado === 'retenida').length
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginated = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalCols = innerTab === 'todas' ? 20 : 19

  function renderCell(op: Operacion, field: keyof Operacion, extraStyle?: React.CSSProperties) {
    const key = `${op.id}-${field}`
    const status = cellStates[key]
    const isEditingCell = editing?.id === op.id && editing?.field === field
    const inputType = FIELD_TYPE[field] ?? 'text'
    if (isEditingCell) {
      return (
        <input autoFocus type={inputType} value={editing.value}
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
    let borderColor = 'transparent'; let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }
    return (
      <div onClick={() => startEdit(op, field)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden', ...(extraStyle ?? {}) }} className={!status ? 'cell-hover' : ''}>
        <span style={{ color: isEmpty ? '#D1CBC3' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'center' }}>
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
        <input autoFocus type={inputType} value={editing.value}
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
    let borderColor = 'transparent'; let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }
    return (
      <div onClick={() => startEdit(op, field)} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden' }} className={!status ? 'cell-hover' : ''}>
        <span style={{ color: isEmpty ? '#D1CBC3' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
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
      badge = <span style={{ color: '#D1CBC3' }}>—</span>
    } else if (estado === 'retenida') {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px 1px 5px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#FBDDD4', color: '#991B1B' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Retenida</span>
    } else if (estado === 'liberada') {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px 1px 5px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#E1F1D6', color: '#166534' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Liberada</span>
    } else {
      badge = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px 1px 5px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: '#E0E4FB', color: '#3730A3' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />Vinc.{vinculacion ? ` ${formatDateShort(vinculacion)}` : ''}</span>
    }
    return (
      <div onClick={e => openSenasaPopover(op, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'pointer', minHeight: 20 }} className="cell-hover">
        {badge}
      </div>
    )
  }

  function renderCanalCell(op: Operacion) {
    const CANAL_MAP: Record<string, { label: string; bg: string; color: string; dot: string }> = {
      V: { label: 'Verde',    bg: '#E1F1D6', color: '#15803D', dot: '#16A34A' },
      R: { label: 'Rojo',     bg: '#FBDDD4', color: '#991B1B', dot: '#DC2626' },
      N: { label: 'Naranja',  bg: '#FDE6CB', color: '#9A3412', dot: '#EA580C' },
      A: { label: 'Amarillo', bg: '#FCEBC4', color: '#92400E', dot: '#D97706' },
    }
    const entry = op.canal && CANAL_MAP[op.canal] ? CANAL_MAP[op.canal] : null
    return (
      <div
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          setCanalPopover({ id: op.id, top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 140) })
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'pointer', minHeight: 20 }}
        className="cell-hover"
      >
        {entry ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px 1px 5px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: entry.bg, color: entry.color }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.dot, flexShrink: 0, display: 'inline-block' }} />
            {entry.label}
          </span>
        ) : (
          <span style={{ color: '#D1CBC3' }}>—</span>
        )}
      </div>
    )
  }

  function renderTransporteCell(op: Operacion) {
    if (transporteEditing === op.id) {
      return (
        <select
          autoFocus
          defaultValue={op.transporte ?? ''}
          onChange={async e => {
            const val = e.target.value || null
            const oldOp = operaciones.find(o => o.id === op.id)
            if (!oldOp) return
            setOperaciones(prev => prev.map(o => o.id === op.id ? { ...o, transporte: val } : o))
            setTransporteEditing(null)
            const supabase = createClient()
            const { error } = await supabase.from('operaciones').update({ transporte: val }).eq('id', op.id)
            if (error) setOperaciones(prev => prev.map(o => o.id === op.id ? oldOp : o))
          }}
          onBlur={() => setTransporteEditing(null)}
          style={{ fontSize: 12, border: '1px solid #1E40AF', borderRadius: 4, padding: '1px 4px', outline: 'none', background: '#FFFFFF', color: '#1F1B14', boxShadow: '0 0 0 3px rgba(29,78,216,.12)', cursor: 'pointer', width: '100%' }}
        >
          <option value="">—</option>
          {transporteNombres.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )
    }
    return (
      <div onClick={() => setTransporteEditing(op.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20 }} className="cell-hover">
        <span style={{ color: !op.transporte ? '#D1CBC3' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          {op.transporte ?? '—'}
        </span>
      </div>
    )
  }

  const TH: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9589',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    background: 'transparent',
  }

  /* Keyboard key — reference style */
  function Kbd({ children }: { children: React.ReactNode }) {
    return (
      <kbd style={{
        fontFamily: 'ui-monospace, monospace',
        background: '#F2ECDC',
        border: '1px solid #E8DFC5',
        color: '#4A4332',
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 10.5,
        fontWeight: 500,
        boxShadow: '0 1px 0 #D6C9A0',
        minWidth: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.5,
      }}>
        {children}
      </kbd>
    )
  }

  return (
    <>
      <style>{`
        .cell-hover:hover { background: rgba(31,27,20,.05); }
        .row-h { transition: background 60ms; }
        .row-h td { background: transparent; }
        .row-h:hover td { background: ${ROW_HOVER} !important; }
        .row-h td.col-stripe { background: transparent !important; }
        .row-h:hover .act-btn { opacity: 1 !important; }
        .act-btn:hover { background: rgba(31,27,20,.07) !important; color: #1F1B14 !important; }
        .interno-link { cursor: pointer; }
        .interno-link:hover { text-decoration: underline; text-underline-offset: 2px; }
        .col-stripe { width: 4px; min-width: 4px; padding: 0 !important; position: sticky; left: 0; z-index: 4; }
        .st-interno  { position: sticky; left: 4px;   z-index: 2; background: ${PAGE_BG}; }
        .st-cliente  { position: sticky; left: 66px;  z-index: 2; background: ${PAGE_BG}; }
        .st-action   { position: sticky; right: 0px;  z-index: 2; background: ${PAGE_BG}; }
        .st-estado   { position: sticky; right: 32px; z-index: 2; background: ${PAGE_BG}; }
        .row-h:hover .st-interno  { background: ${ROW_HOVER}; }
        .row-h:hover .st-cliente  { background: ${ROW_HOVER}; }
        .row-h:hover .st-action   { background: ${ROW_HOVER}; }
        .row-h:hover .st-estado   { background: ${ROW_HOVER}; }
        th.col-stripe { background: ${PAGE_BG}; z-index: 5; }
        th.st-interno { background: ${PAGE_BG}; z-index: 3; }
        th.st-cliente { background: ${PAGE_BG}; z-index: 3; }
        th.st-action  { background: ${PAGE_BG}; z-index: 3; }
        th.st-estado  { background: ${PAGE_BG}; z-index: 3; }

        /* Segmented control — Mis / Todas */
        .seg { display: inline-flex; background: #F2ECDC; border: 1px solid #E8DFC5; border-radius: 6px; padding: 2px; gap: 0; }
        .seg-btn { border: none; background: transparent; color: #4A4332; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; line-height: 1; }
        .seg-btn.on { background: #FFFFFF; color: #1F1B14; box-shadow: 0 1px 0 rgba(31,27,20,.04), 0 1px 2px rgba(31,27,20,.05); }

        /* Chips — Atrasadas, Retenidas, Filtros, Ordenar */
        .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 8px; border: 1px solid #E8DFC5; border-radius: 100px; background: #F2ECDC; font-size: 12px; color: #4A4332; cursor: pointer; height: 28px; white-space: nowrap; transition: border-color 80ms, background 80ms, box-shadow 80ms; }
        .chip:hover { background: #EAE3CE; border-color: #D6C9A0; }
        .chip.active { background: #FFFFFF !important; color: #1F1B14 !important; border-color: #E8DFC5 !important; box-shadow: 0 1px 0 rgba(31,27,20,.04), 0 1px 2px rgba(31,27,20,.05) !important; font-weight: 500 !important; }
        .chip-count { background: #E8DFC5; border-radius: 100px; padding: 0 6px; font-size: 11px; color: #4A4332; margin-left: 2px; line-height: 1.6; }
        .chip.active .chip-count { background: #E8DFC5; color: #1F1B14; }

        /* Toolbar separator */
        .toolbar-sep { width: 1px; height: 18px; background: #E8DFC5; margin: 0 4px; flex-shrink: 0; }

        /* Search box */
        .search-box { display: flex; align-items: center; gap: 6px; background: #F2ECDC; border: 1px solid #E8DFC5; border-radius: 6px; padding: 0 10px; height: 28px; min-width: 220px; transition: border-color 80ms, background 80ms, box-shadow 80ms; }
        .search-box:focus-within { background: #FFFFFF; border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(29,78,216,.12); }
        .search-box input { border: none; background: transparent; outline: none; font-size: 12px; color: #1F1B14; width: 100%; }

        /* Icon-only toolbar buttons */
        .tbtn-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #E8DFC5; border-radius: 6px; background: #F2ECDC; color: #7A7158; cursor: pointer; transition: background 80ms, color 80ms; }
        .tbtn-icon:hover { background: #EAE3CE; color: #1F1B14; }

        /* Keyboard bar */
        .kbd-bar { display: flex; flex-wrap: wrap; gap: 16px; padding: 10px 14px; margin-top: 12px; color: #7A7158; font-size: 11px; background: #FFFFFF; border: 1px solid #E8DFC5; border-radius: 10px; }
        .kbd-group { display: inline-flex; align-items: center; gap: 5px; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1F1B14', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>Operaciones</h1>
            <p style={{ fontSize: 12, color: '#7A7158', margin: '2px 0 0', lineHeight: 1.4 }}>
              {loading ? 'Cargando...' : (
                section === 'pendientes'
                  ? `Mostrando ${filtradas.length} pendiente${filtradas.length !== 1 ? 's' : ''} · ${pendientes.length} pendientes en total · ${liberadas.length} liberadas`
                  : `Mostrando ${filtradas.length} liberada${filtradas.length !== 1 ? 's' : ''} · ${liberadas.length} liberadas en total`
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28, fontSize: 12, fontWeight: 500, color: '#1F1B14', background: SURFACE, border: '1px solid #E8DFC5', borderRadius: 6, cursor: 'pointer', transition: 'background 80ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F2ECDC' }}
              onMouseLeave={e => { e.currentTarget.style.background = SURFACE }}
            >
              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar
            </button>
            <button
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28, fontSize: 12, fontWeight: 500, color: '#FFFFFF', background: '#1F1B14', border: '1px solid #1F1B14', borderRadius: 6, cursor: 'pointer', transition: 'background 80ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#000000' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1F1B14' }}
            >
              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nueva operación
              <kbd style={{ fontFamily: 'ui-monospace, monospace', background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', color: 'rgba(255,255,255,.9)', padding: '1px 5px', fontSize: 10, borderRadius: 3 }}>N</kbd>
            </button>
          </div>
        </div>

        {/* ── Section tabs ── */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E8DFC5', marginBottom: 10 }}>
          {([
            { key: 'pendientes', label: 'Pendientes de liberación', count: pendientes.length },
            { key: 'liberadas',  label: 'Liberadas',                count: liberadas.length  },
          ] as { key: Section; label: string; count: number }[]).map(s => (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              padding: '8px 14px 10px', fontSize: 13, fontWeight: section === s.key ? 600 : 500,
              border: 'none', background: 'none', cursor: 'pointer',
              color: section === s.key ? '#1F1B14' : '#7A7158',
              borderBottom: section === s.key ? '2px solid #1F1B14' : '2px solid transparent',
              marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'color 100ms',
            }}>
              {s.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 7px', borderRadius: 100,
                fontSize: 11, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                background: section === s.key ? '#1F1B14' : '#F2ECDC',
                color: section === s.key ? '#FFFFFF' : '#7A7158',
              }}>
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0', marginBottom: 10 }}>
          {/* Segmented: Mis / Todas */}
          <div className="seg">
            <button className={`seg-btn${innerTab === 'mis' ? ' on' : ''}`} onClick={() => setInnerTab('mis')}>
              Mis operaciones{misCount > 0 && <span style={{ color: '#ADA482', marginLeft: 4 }}>{misCount}</span>}
            </button>
            <button className={`seg-btn${innerTab === 'todas' ? ' on' : ''}`} onClick={() => setInnerTab('todas')}>
              Todas
            </button>
          </div>

          {section === 'pendientes' && (
            <>
              <div className="toolbar-sep" />
              <button onClick={() => setChipAtrasadas(v => !v)} className={`chip${chipAtrasadas ? ' active' : ''}`}>
                <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth="2" />
                  <path d="M12 7v5l3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Atrasadas
                <span className="chip-count">{atrasadasCount}</span>
              </button>
              <button onClick={() => setChipRetenidas(v => !v)} className={`chip${chipRetenidas ? ' active' : ''}`}>
                <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Retenidas en SENASA
                <span className="chip-count">{retenidasCount}</span>
              </button>
            </>
          )}

          <div className="toolbar-sep" />

          <button className="chip">
            <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filtros
          </button>
          <button className="chip">
            <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Ordenar
          </button>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div className="search-box">
            <svg style={{ width: 12, height: 12, color: '#7A7158', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar interno, cliente, OC, factura..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {!busqueda && (
              <kbd style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: '#ADA482', border: '1px solid #E8DFC5', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>/</kbd>
            )}
          </div>

          <button className="tbtn-icon" onClick={cargarOperaciones} title="Actualizar">
            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button className="tbtn-icon" title="Más opciones">
            <svg style={{ width: 14, height: 14 }} fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FBDDD4', border: '1px solid #F9C7BB', borderRadius: 6, fontSize: 13, color: '#991B1B', marginBottom: 10 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Table card ── */}
        <div style={{ background: 'transparent', border: '1px solid #EDE9E3', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 0 rgba(31,27,20,.04), 0 1px 2px rgba(31,27,20,.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, color: '#1C1917', tableLayout: 'fixed', minWidth: 1200 }}>
              <colgroup>
                <col style={{ width: 4 }} />    {/* stripe */}
                <col style={{ width: 62 }} />   {/* interno */}
                <col style={{ width: 60 }} />   {/* recep */}
                <col style={{ width: 156 }} />  {/* cliente */}
                <col style={{ width: 66 }} />   {/* oc */}
                <col style={{ width: 86 }} />   {/* factura */}
                <col style={{ width: 82 }} />   {/* crt */}
                <col style={{ width: 110 }} />  {/* transporte */}
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
                <tr style={{ borderBottom: '1px solid #EDE9E3' }}>
                  <th className="col-stripe" />
                  <th style={{ ...TH, paddingLeft: 8 }} className="st-interno">Inter.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Recepción de documentos">Recep.</th>
                  <th style={TH} className="st-cliente">Cliente</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Orden de compra del cliente">OC</th>
                  <th style={TH}>Factura</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Carta de porte internacional">CRT</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Empresa de transporte">Transporte</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Pedido de fondos">Ped. $</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Número SENASA">SENASA</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Estado SENASA" className="st-estado">Est. SENASA</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Fecha de oficialización">Ofic.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Número de despacho">Despacho</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Canal aduanero">Canal</th>
                  <th style={TH}>Aviso</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Nota de entrega">Nota Ent.</th>
                  <th style={{ ...TH, cursor: 'help' }} title="Fecha de liberación">Liberación</th>
                  {innerTab === 'todas' && <th style={TH}>Cargado por</th>}
                  <th style={{ ...TH, width: 32, padding: '8px 4px' }} className="st-action" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={totalCols} style={{ padding: '48px 16px', textAlign: 'center', color: '#78716C', background: 'transparent' }}>
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
                    <td colSpan={totalCols} style={{ padding: '64px 16px', textAlign: 'center', background: 'transparent' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <svg style={{ width: 32, height: 32, color: '#E8DFC5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p style={{ fontSize: 13, color: '#ADA482', margin: 0 }}>
                          {busqueda || chipAtrasadas || chipRetenidas
                            ? 'No hay operaciones con esos filtros.'
                            : section === 'pendientes' ? 'No hay operaciones pendientes.' : 'No hay operaciones liberadas.'}
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
                  paginated.map(op => {
                    const atrasada = isAtrasada(op)

                    return (
                      <tr key={op.id} className="row-h" style={{ borderBottom: '1px solid #EDE9E3', height: 40 }}>

                        {/* Stripe — 3px inset shadow on left for atrasada rows */}
                        <td className="col-stripe" style={atrasada ? { boxShadow: 'inset 3px 0 0 #DC2626' } : undefined} />

                        {/* Interno — red if atrasada, blue otherwise */}
                        <td style={{ padding: '0 6px 0 8px', overflow: 'hidden', verticalAlign: 'middle' }} className="st-interno">
                          <div
                            className="interno-link"
                            onClick={() => setPanelOp(op)}
                            style={{ fontWeight: 700, color: atrasada ? '#DC2626' : '#2563EB', ...MONO, lineHeight: 1.2, display: 'inline-flex', alignItems: 'center' }}
                          >
                            {op.interno ?? '—'}
                          </div>
                        </td>

                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'recep_doc')}
                        </td>

                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', fontWeight: 600, color: '#111827' }} className="st-cliente">
                          {renderCellLeft(op, 'cliente')}
                        </td>

                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...MONO, color: '#374151' }}>
                          {renderCell(op, 'oc', MONO)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...MONO, color: '#374151' }}>
                          {renderCell(op, 'factura', MONO)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...MONO, color: '#374151' }}>
                          {renderCell(op, 'crt', MONO)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderTransporteCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'fecha_pedido_fondos')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...MONO, color: '#374151' }}>
                          {renderCell(op, 'senasa', MONO)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle' }} className="st-estado">
                          {renderSenasaCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'oficializacion')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...MONO, color: '#374151' }}>
                          {renderCell(op, 'despacho', MONO)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCanalCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'aviso')}
                        </td>
                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'nota_entrega')}
                        </td>
                        <td style={{ padding: '0 10px', color: '#374151', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCell(op, 'liberacion')}
                        </td>

                        {innerTab === 'todas' && (
                          <td style={{ padding: '0 10px', color: '#C4BDB5', overflow: 'hidden', fontSize: 11, verticalAlign: 'middle' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {op.created_by_email ?? '—'}
                            </span>
                          </td>
                        )}

                        <td style={{ padding: '0 4px', overflow: 'hidden', textAlign: 'center', verticalAlign: 'middle' }} className="st-action">
                          <button onClick={() => setPanelOp(op)} title="Ver detalle" className="act-btn"
                            style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#7A7158', borderRadius: 4, display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 100ms, background 100ms' }}>
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

          {/* Table footer — inside card, surface-2 background */}
          {!loading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F2ECDC', borderTop: '1px solid #EDE9E3', color: '#78716C', fontSize: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span>{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#ADA482' }}>·</span>
                <span>Última carga: {timeAgoStr}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ border: '1px solid #E8DFC5', background: SURFACE, height: 24, padding: '0 8px', borderRadius: 4, fontSize: 12, color: page <= 1 ? '#ADA482' : '#4A4332', cursor: page <= 1 ? 'default' : 'pointer' }}
                >‹</button>
                <button style={{ border: '1px solid #1F1B14', background: '#1F1B14', height: 24, padding: '0 8px', borderRadius: 4, fontSize: 12, color: 'white', cursor: 'default' }}>{page}</button>
                {totalPages > 1 && page < totalPages && (
                  <button style={{ border: '1px solid #E8DFC5', background: SURFACE, height: 24, padding: '0 8px', borderRadius: 4, fontSize: 12, color: '#4A4332', cursor: 'default' }}>{page + 1}</button>
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ border: '1px solid #E8DFC5', background: SURFACE, height: 24, padding: '0 8px', borderRadius: 4, fontSize: 12, color: page >= totalPages ? '#ADA482' : '#4A4332', cursor: page >= totalPages ? 'default' : 'pointer' }}
                >›</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Keyboard hints bar — inline, not fixed ── */}
        <div className="kbd-bar">
          <div className="kbd-group"><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd><span>navegar celdas</span></div>
          <div className="kbd-group"><Kbd>2x click</Kbd><span>o</span><Kbd>Enter</Kbd><span>editar celda</span></div>
          <div className="kbd-group"><Kbd>Tab</Kbd><span>siguiente</span></div>
          <div className="kbd-group"><Kbd>/</Kbd><span>buscar</span></div>
          <div className="kbd-group"><Kbd>N</Kbd><span>nueva operación</span></div>
        </div>
      </div>

      {/* ── Canal Popover ── */}
      {canalPopover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setCanalPopover(null)} />
          <div style={{ position: 'fixed', top: canalPopover.top, left: canalPopover.left, zIndex: 50, background: SURFACE, border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 6, minWidth: 120 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {([
                { value: '',  label: 'Sin canal', badge: null },
                { value: 'V', label: 'Verde',    badge: { bg: '#E1F1D6', color: '#15803D', dot: '#16A34A' } },
                { value: 'R', label: 'Rojo',     badge: { bg: '#FBDDD4', color: '#991B1B', dot: '#DC2626' } },
                { value: 'N', label: 'Naranja',  badge: { bg: '#FDE6CB', color: '#9A3412', dot: '#EA580C' } },
                { value: 'A', label: 'Amarillo', badge: { bg: '#FCEBC4', color: '#92400E', dot: '#D97706' } },
              ] as { value: string; label: string; badge: { bg: string; color: string; dot: string } | null }[]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={async () => {
                    const val = opt.value || null
                    const id = canalPopover.id
                    const oldOp = operaciones.find(o => o.id === id)
                    if (!oldOp) return
                    setOperaciones(prev => prev.map(o => o.id === id ? { ...o, canal: val } : o))
                    setCanalPopover(null)
                    const supabase = createClient()
                    const { error } = await supabase.from('operaciones').update({ canal: val }).eq('id', id)
                    if (error) setOperaciones(prev => prev.map(o => o.id === id ? oldOp : o))
                  }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '5px 8px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent', color: '#1F1B14', fontWeight: 400, transition: 'background 80ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F2ECDC' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {opt.badge ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 8px 1px 6px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: opt.badge.bg, color: opt.badge.color }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.badge.dot, flexShrink: 0 }} />
                      {opt.label}
                    </span>
                  ) : (
                    <span style={{ color: '#ADA482', fontSize: 12 }}>Sin canal</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── SENASA Popover ── */}
      {senasaPopover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setSenasaPopover(null)} />
          <div style={{ position: 'fixed', top: senasaPopover.top, left: senasaPopover.left, zIndex: 50, background: SURFACE, border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 6, width: 168 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SENASA_OPCIONES.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setSenasaPopover(prev => prev ? { ...prev, estado: opt.value } : null)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 80ms', background: senasaPopover.estado === opt.value ? '#1F1B14' : 'transparent', color: senasaPopover.estado === opt.value ? '#FFFFFF' : '#1F1B14', fontWeight: senasaPopover.estado === opt.value ? 500 : 400 }}
                >{opt.label}</button>
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
                onMouseEnter={e => { e.currentTarget.style.background = '#000000' }}
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
        <PanelDetalle op={panelOp} onClose={() => setPanelOp(null)} onSave={handlePanelSave} />
      )}
    </>
  )
}
