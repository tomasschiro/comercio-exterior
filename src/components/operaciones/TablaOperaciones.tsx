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

function applyFieldTransform(field: keyof Operacion, value: string): string {
  if (field === 'despacho') return value.toUpperCase().slice(0, 11)
  if (field === 'senasa') return value.replace(/\D/g, '').slice(0, 7)
  if (field === 'crt') return value.replace(/\D/g, '').slice(0, 9)
  return value
}

const EDITABLE_FIELDS: (keyof Operacion)[] = [
  'recep_doc', 'cliente', 'oc', 'factura', 'crt',
  'fecha_pedido_fondos', 'senasa', 'oficializacion',
  'despacho', 'aviso', 'nota_entrega', 'liberacion',
]

function parseShortDate(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
  if (m) {
    const year = new Date().getFullYear()
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (/^\d{4}$/.test(s)) {
    const year = new Date().getFullYear()
    return `${year}-${s.slice(2, 4)}-${s.slice(0, 2)}`
  }
  return null
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

const DATE_STYLE: React.CSSProperties = { fontWeight: 400, color: '#374151', fontSize: 12 }

const CELL_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '2px 4px',
  fontSize: 12,
  fontFamily: 'inherit',
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

export default function TablaOperaciones({ userEmail, userId, userRol }: Props) {
  const [operaciones, setOperaciones] = useState<Operacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>('pendientes')
  const [innerTab, setInnerTab] = useState<InnerTab>('mis')
  const [chipAtrasadas, setChipAtrasadas] = useState(false)
  const [chipRetenidas, setChipRetenidas] = useState(false)
  const [chipImportacion, setChipImportacion] = useState(false)
  const [chipExportacion, setChipExportacion] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [panelOp, setPanelOp] = useState<Operacion | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [cellStates, setCellStates] = useState<Record<string, CellStatus>>({})
  const [senasaPopover, setSenasaPopover] = useState<SenasaPopoverState | null>(null)
  const [canalEditing, setCanalEditing] = useState<number | null>(null)
  const [transporteEditing, setTransporteEditing] = useState<number | null>(null)
  const [transporteNombres, setTransporteNombres] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loadedAt, setLoadedAt] = useState<Date>(new Date())
  const [timeAgoStr, setTimeAgoStr] = useState('hace un momento')
  const [sortKey, setSortKey] = useState<'reciente' | 'antigua' | 'cliente' | 'interno' | 'dias'>('reciente')
  const [sortOpen, setSortOpen] = useState(false)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')
  const suppressBlurRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; interno: number | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mailConfirmModal, setMailConfirmModal] = useState<{ id: number; interno: number | null } | null>(null)
  const [sendingMail, setSendingMail] = useState(false)

  const cargarOperaciones = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      console.log('cargarOperaciones: llamando a Supabase...')
      const { data, error } = await supabase
        .from('operaciones')
        .select('*')
        .order('created_at', { ascending: false })
      console.log('cargarOperaciones: respuesta:', { count: data?.length, error })
      if (error) setError(error.message)
      else {
        setOperaciones(data || [])
        const now = new Date()
        setLoadedAt(now)
        setTimeAgoStr(getTimeAgo(now))
      }
    } catch (e) {
      console.error('cargarOperaciones: excepción:', e)
      setError(e instanceof Error ? e.message : 'Error desconocido al cargar datos')
    } finally {
      setLoading(false)
    }
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
      if (e.key === 'Escape') { searchRef.current?.blur(); setSortOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!sortOpen) return
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  useEffect(() => {
    if (!moreOpen) return
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  useEffect(() => { setPage(1) }, [section, innerTab, chipAtrasadas, chipRetenidas, busqueda, filterDesde, filterHasta])


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
    const value = FIELD_TYPE[field] === 'date'
      ? formatDateShort(op[field] as string | null)
      : getRawValue(op, field)
    setEditing({ id: op.id, field, value })
  }

  async function enviarMailLiberacion(id: number): Promise<void> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    await fetch('/api/operaciones/liberar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, mail_enviado: true } : op))
    if (panelOp?.id === id) setPanelOp(prev => prev ? { ...prev, mail_enviado: true } : null)
  }

  async function updateOperacion(id: number, updates: Record<string, unknown>): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return 'No hay sesión activa'
    const res = await fetch('/api/operaciones/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, updates }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return (json.error as string) || `Error ${res.status}`
    }
    return null
  }

  async function commitEdit(cell: EditingCell) {
    const { id, field, value } = cell
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return
    const oldValue = oldOp[field]
    let parsed: string | number | null
    if (value.trim() === '') { parsed = null }
    else if (field === 'interno') { parsed = parseInt(value) || null }
    else if (FIELD_TYPE[field] === 'date') { parsed = parseShortDate(value) }
    else { parsed = value.trim() }
    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, [field]: parsed } : op))
    if (panelOp?.id === id) setPanelOp(prev => prev ? { ...prev, [field]: parsed } : null)
    setEditing(null)
    setCellStatus(id, field, 'saving')
    const error = await updateOperacion(id, { [field]: parsed })
    if (error) {
      setOperaciones(prev => prev.map(op => op.id === id ? { ...op, [field]: oldValue } : op))
      if (panelOp?.id === id) setPanelOp(prev => prev ? { ...prev, [field]: oldValue } : null)
      setCellStatus(id, field, 'error')
      setTimeout(() => setCellStatus(id, field, null), 1200)
    } else {
      setCellStatus(id, field, 'success')
      setTimeout(() => setCellStatus(id, field, null), 1200)
      if (field === 'liberacion' && parsed !== null) {
        setMailConfirmModal({ id, interno: oldOp.interno })
      }
    }
  }

  function openSenasaPopover(op: Operacion, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 196)
    setSenasaPopover({ id: op.id, estado: ((op.senasa_estado as SenasaEstado) || 'pendiente'), vinculacion: formatDateShort(op.senasa_vinculacion), top: rect.bottom + 4, left })
  }

  async function saveSenasaEstado() {
    if (!senasaPopover) return
    const { id, estado, vinculacion } = senasaPopover
    const oldOp = operaciones.find(o => o.id === id)
    if (!oldOp) return
    const parsedVinculacion = parseShortDate(vinculacion)
    const updates = { senasa_estado: estado, senasa_vinculacion: estado === 'vinculada' && parsedVinculacion ? parsedVinculacion : null }
    setOperaciones(prev => prev.map(op => op.id === id ? { ...op, ...updates } : op))
    setSenasaPopover(null)
    const error = await updateOperacion(id, updates)
    if (error) setOperaciones(prev => prev.map(op => op.id === id ? oldOp : op))
  }

  async function handlePanelSave(updated: Operacion) {
    const oldOp = operaciones.find(o => o.id === updated.id)
    if (!oldOp) return
    setOperaciones(prev => prev.map(op => op.id === updated.id ? updated : op))
    setPanelOp(updated)
    const error = await updateOperacion(updated.id, {
      tipo: updated.tipo,
      interno: updated.interno, recep_doc: updated.recep_doc, cliente: updated.cliente,
      transporte: updated.transporte, factura: updated.factura, oc: updated.oc,
      fecha_pedido_fondos: updated.fecha_pedido_fondos, crt: updated.crt,
      senasa: updated.senasa, senasa_estado: updated.senasa_estado,
      senasa_vinculacion: updated.senasa_vinculacion, canal: updated.canal,
      despacho: updated.despacho, oficializacion: updated.oficializacion,
      aviso: updated.aviso, nota_entrega: updated.nota_entrega, liberacion: updated.liberacion,
    })
    if (error) {
      setOperaciones(prev => prev.map(op => op.id === updated.id ? oldOp : op))
      setPanelOp(oldOp)
      throw new Error(error)
    }
  }

  async function deleteOperacion(id: number): Promise<string | null> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return 'No hay sesión activa'
    const res = await fetch('/api/operaciones/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return (json.error as string) || `Error ${res.status}`
    }
    return null
  }

  async function handleDeleteConfirmed() {
    if (!deleteConfirm) return
    setDeleting(true)
    const err = await deleteOperacion(deleteConfirm.id)
    setDeleting(false)
    if (!err) {
      setOperaciones(prev => prev.filter(op => op.id !== deleteConfirm.id))
      setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteConfirm.id); return next })
      if (panelOp?.id === deleteConfirm.id) setPanelOp(null)
    }
    setDeleteConfirm(null)
  }

  const pendientes = operaciones.filter(op => !op.liberacion)
  const liberadasCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0] })()
  const liberadas = operaciones.filter(op => !!op.liberacion && op.liberacion >= liberadasCutoff)
  const base = section === 'pendientes' ? pendientes : liberadas

  const filtradas = base.filter(op => {
    if (innerTab === 'mis' && userId && op.created_by !== userId) return false
    if (chipAtrasadas && !isAtrasada(op)) return false
    if (chipRetenidas && op.senasa_estado !== 'retenida') return false
    if (chipImportacion && (op.tipo ?? 'importacion') !== 'importacion') return false
    if (chipExportacion && op.tipo !== 'exportacion') return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!(
        op.cliente?.toLowerCase().includes(q) ||
        op.despacho?.toLowerCase().includes(q) ||
        op.crt?.toLowerCase().includes(q) ||
        op.factura?.toLowerCase().includes(q) ||
        op.oc?.toLowerCase().includes(q) ||
        String(op.interno ?? '').includes(q)
      )) return false
    }
    const opDate = op.created_at ? op.created_at.split('T')[0] : ''
    if (filterDesde && opDate < filterDesde) return false
    if (filterHasta && opDate > filterHasta) return false
    return true
  })

  const misCount = userId ? base.filter(op => op.created_by === userId).length : 0
  const atrasadasCount = base.filter(isAtrasada).length
  const retenidasCount = base.filter(op => op.senasa_estado === 'retenida').length
  const importacionCount = base.filter(op => (op.tipo ?? 'importacion') === 'importacion').length
  const exportacionCount = base.filter(op => op.tipo === 'exportacion').length
  const hasBothTypes = filtradas.some(op => (op.tipo ?? 'importacion') === 'importacion') && filtradas.some(op => op.tipo === 'exportacion')
  const sorted = [...filtradas].sort((a, b) => {
    if (sortKey === 'antigua')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sortKey === 'cliente')  return (a.cliente ?? '').localeCompare(b.cliente ?? '', 'es')
    if (sortKey === 'interno')  return (b.interno ?? 0) - (a.interno ?? 0)
    if (sortKey === 'dias')     return getDiasEnEtapa(b) - getDiasEnEtapa(a)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalCols = innerTab === 'todas' ? 20 : 19

  function handleExport() {
    const headers = ['Interno', 'Recep. Docs', 'Cliente', 'OC', 'Factura', 'CRT', 'Transporte', 'Ped. Fondos', 'SENASA', 'Est. SENASA', 'Oficialización', 'Despacho', 'Canal', 'Aviso', 'Nota Entrega', 'Liberación', 'Cargado por', 'Fecha alta']
    const rows = filtradas.map(op => [
      op.interno ?? '',
      op.recep_doc ?? '',
      op.cliente ?? '',
      op.oc ?? '',
      op.factura ?? '',
      op.crt ?? '',
      op.transporte ?? '',
      op.fecha_pedido_fondos ?? '',
      op.senasa ?? '',
      op.senasa_estado ?? '',
      op.oficializacion ?? '',
      op.despacho ?? '',
      op.canal ?? '',
      op.aviso ?? '',
      op.nota_entrega ?? '',
      op.liberacion ?? '',
      op.created_by_email ?? '',
      op.created_at ? op.created_at.split('T')[0] : '',
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const bom = '﻿'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operaciones-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function renderCell(op: Operacion, field: keyof Operacion, extraStyle?: React.CSSProperties) {
    const key = `${op.id}-${field}`
    const status = cellStates[key]
    const isEditingCell = editing?.id === op.id && editing?.field === field
    const inputType = FIELD_TYPE[field] === 'date' ? 'text' : (FIELD_TYPE[field] ?? 'text')
    if (isEditingCell) {
      return (
        <input autoFocus type={inputType} value={editing.value}
          placeholder={FIELD_TYPE[field] === 'date' ? 'DD/MM' : undefined}
          maxLength={field === 'despacho' ? 11 : field === 'senasa' ? 7 : field === 'crt' ? 9 : undefined}
          onChange={e => setEditing(prev => prev ? { ...prev, value: applyFieldTransform(field, e.target.value) } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); suppressBlurRef.current = true; commitEdit(editing) }
            else if (e.key === 'Escape') { e.preventDefault(); suppressBlurRef.current = true; setEditing(null) }
            else if (e.key === 'Tab') {
              e.preventDefault()
              suppressBlurRef.current = true
              commitEdit(editing)
              const fieldIdx = EDITABLE_FIELDS.indexOf(field)
              const rowIdx = paginated.findIndex(o => o.id === op.id)
              if (e.shiftKey) {
                if (fieldIdx > 0) startEdit(op, EDITABLE_FIELDS[fieldIdx - 1])
                else if (rowIdx > 0) startEdit(paginated[rowIdx - 1], EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1])
              } else {
                if (fieldIdx < EDITABLE_FIELDS.length - 1) startEdit(op, EDITABLE_FIELDS[fieldIdx + 1])
                else if (rowIdx < paginated.length - 1) startEdit(paginated[rowIdx + 1], EDITABLE_FIELDS[0])
              }
            }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) { suppressBlurRef.current = false; return }
            setEditing(prev => { if (prev && prev.id === op.id && prev.field === field) { commitEdit(prev); return null } return prev })
          }}
          style={{ ...CELL_INPUT, ...(extraStyle ?? {}), minWidth: 60, ...(field === 'despacho' ? { textTransform: 'uppercase' as const } : {}) }}
        />
      )
    }
    const displayValue = getDisplayValue(op, field)
    const isEmpty = displayValue === '—'
    const isNA = displayValue === 'n/a'
    let borderColor = 'transparent'; let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }
    return (
      <div onClick={() => startEdit(op, field)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden', ...(extraStyle ?? {}) }} className={!status ? 'cell-hover' : ''}>
        <span style={{ color: isEmpty || isNA ? '#C9C3BB' : undefined, fontStyle: isNA ? 'italic' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'center' }}>
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
          maxLength={field === 'despacho' ? 11 : field === 'senasa' ? 7 : field === 'crt' ? 9 : undefined}
          onChange={e => setEditing(prev => prev ? { ...prev, value: applyFieldTransform(field, e.target.value) } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); suppressBlurRef.current = true; commitEdit(editing) }
            else if (e.key === 'Escape') { e.preventDefault(); suppressBlurRef.current = true; setEditing(null) }
            else if (e.key === 'Tab') {
              e.preventDefault()
              suppressBlurRef.current = true
              commitEdit(editing)
              const fieldIdx = EDITABLE_FIELDS.indexOf(field)
              const rowIdx = paginated.findIndex(o => o.id === op.id)
              if (e.shiftKey) {
                if (fieldIdx > 0) startEdit(op, EDITABLE_FIELDS[fieldIdx - 1])
                else if (rowIdx > 0) startEdit(paginated[rowIdx - 1], EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1])
              } else {
                if (fieldIdx < EDITABLE_FIELDS.length - 1) startEdit(op, EDITABLE_FIELDS[fieldIdx + 1])
                else if (rowIdx < paginated.length - 1) startEdit(paginated[rowIdx + 1], EDITABLE_FIELDS[0])
              }
            }
          }}
          onBlur={() => {
            if (suppressBlurRef.current) { suppressBlurRef.current = false; return }
            setEditing(prev => { if (prev && prev.id === op.id && prev.field === field) { commitEdit(prev); return null } return prev })
          }}
          style={{ ...CELL_INPUT, minWidth: 80, ...(field === 'despacho' ? { textTransform: 'uppercase' as const } : {}) }}
        />
      )
    }
    const displayValue = getDisplayValue(op, field)
    const isEmpty = displayValue === '—'
    const isNA = displayValue === 'n/a'
    let borderColor = 'transparent'; let bgColor = 'transparent'
    if (status === 'saving')  { borderColor = '#E8DFC5' }
    if (status === 'success') { borderColor = '#166534'; bgColor = '#E1F1D6' }
    if (status === 'error')   { borderColor = '#991B1B'; bgColor = '#FBDDD4' }
    return (
      <div onClick={() => startEdit(op, field)} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'text', minHeight: 20, border: status ? `1px solid ${borderColor}` : 'none', background: bgColor, transition: 'background 80ms', overflow: 'hidden' }} className={!status ? 'cell-hover' : ''}>
        <span style={{ color: isEmpty || isNA ? '#C9C3BB' : undefined, fontStyle: isNA ? 'italic' : undefined, fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
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
      badge = <span style={{ color: '#C9C3BB' }}>—</span>
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
    const CANAL_DISPLAY: Record<string, { label: string; bg: string; color: string; dot: string }> = {
      V: { label: 'Verde',   bg: '#DCFCE7', color: '#15803D', dot: '#16A34A' },
      R: { label: 'Rojo',    bg: '#FEE2E2', color: '#991B1B', dot: '#DC2626' },
      N: { label: 'Naranja', bg: '#FEF3C7', color: '#92400E', dot: '#D97706' },
    }

    if (canalEditing === op.id) {
      const oldCanal = op.canal
      return (
        <select
          autoFocus
          defaultValue={oldCanal ?? ''}
          onChange={async e => {
            const val = (e.target.value as string) || null
            setOperaciones(prev => prev.map(o => o.id === op.id ? { ...o, canal: val } : o))
            setCanalEditing(null)
            const error = await updateOperacion(op.id, { canal: val })
            if (error) setOperaciones(prev => prev.map(o => o.id === op.id ? { ...o, canal: oldCanal } : o))
          }}
          onBlur={() => setTimeout(() => setCanalEditing(null), 150)}
          style={{ fontSize: 12, border: '1px solid #1E40AF', borderRadius: 4, padding: '1px 4px', outline: 'none', background: '#FFFFFF', color: '#1F1B14', boxShadow: '0 0 0 3px rgba(29,78,216,.12)', cursor: 'pointer', width: '100%' }}
        >
          <option value="">—</option>
          <option value="V">Verde</option>
          <option value="R">Rojo</option>
          <option value="N">Naranja</option>
        </select>
      )
    }

    const entry = op.canal && CANAL_DISPLAY[op.canal] ? CANAL_DISPLAY[op.canal] : null
    return (
      <div
        onClick={() => setCanalEditing(op.id)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: '2px 3px', margin: '0 -3px', cursor: 'pointer', minHeight: 20 }}
        className="cell-hover"
      >
        {entry ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 7px 1px 5px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: entry.bg, color: entry.color }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: entry.dot, flexShrink: 0, display: 'inline-block' }} />
            {entry.label}
          </span>
        ) : (
          <span style={{ color: '#C9C3BB' }}>—</span>
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
            const oldTransporte = op.transporte
            setOperaciones(prev => prev.map(o => o.id === op.id ? { ...o, transporte: val } : o))
            setTransporteEditing(null)
            const error = await updateOperacion(op.id, { transporte: val })
            if (error) setOperaciones(prev => prev.map(o => o.id === op.id ? { ...o, transporte: oldTransporte } : o))
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
        <span style={{ color: !op.transporte ? '#C9C3BB' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
          {op.transporte ?? '—'}
        </span>
      </div>
    )
  }

  const TH: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 500,
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
        .st-estado   { position: sticky; right: 56px; z-index: 2; background: ${PAGE_BG}; }
        .row-h:hover .st-interno  { background: ${ROW_HOVER}; }
        .row-h:hover .st-cliente  { background: ${ROW_HOVER}; }
        .row-h:hover .st-action   { background: ${ROW_HOVER}; }
        .row-h:hover .st-estado   { background: ${ROW_HOVER}; }
        th.col-stripe { background: ${PAGE_BG}; z-index: 5; }
        th.st-interno { background: ${PAGE_BG}; z-index: 3; }
        th.st-cliente { background: ${PAGE_BG}; z-index: 3; }
        th.st-action  { background: ${PAGE_BG}; z-index: 3; }
        th.st-estado  { background: ${PAGE_BG}; z-index: 3; }

        /* Segmented control — Mis / Todas — pill style igual que chips */
        .seg { display: inline-flex; gap: 4px; }
        .seg-btn { display: inline-flex; align-items: center; height: 28px; padding: 0 8px; border: 1px solid #E5E0D8; border-radius: 20px; background: #FFFFFF; font-size: 12px; font-weight: 400; color: #4A4332; cursor: pointer; white-space: nowrap; transition: background 80ms, border-color 80ms, color 80ms; }
        .seg-btn:hover { background: #F5F1EB; border-color: #D6C9A0; }
        .seg-btn.on { background: #1F1B14; color: #FFFFFF; border-color: #1F1B14; font-weight: 500; }
        .seg-btn.on span { color: rgba(255,255,255,0.5); }

        /* Chips — Atrasadas, Retenidas, Filtros, Ordenar */
        .chip { display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; border: 1px solid #E5E0D8; border-radius: 20px; background: #FFFFFF; font-size: 12px; color: #4A4332; cursor: pointer; height: 28px; white-space: nowrap; transition: border-color 80ms, background 80ms; }
        .chip:hover { background: #F5F1EB; border-color: #D6C9A0; }
        .chip.active { background: #1F1B14 !important; color: #FFFFFF !important; border-color: #1F1B14 !important; font-weight: 500 !important; }
        .chip-count { background: rgba(0,0,0,0.07); border-radius: 100px; padding: 1px 5px; font-size: 10px; color: inherit; margin-left: 1px; line-height: 1.5; }
        .chip.active .chip-count { background: rgba(255,255,255,0.2); color: #FFFFFF; }

        /* Toolbar separator */
        .toolbar-sep { width: 1px; height: 16px; background: #E8E5DE; margin: 0 2px; flex-shrink: 0; }

        /* Search box */
        .search-box { display: flex; align-items: center; gap: 8px; background: #FFFFFF; border: 1px solid #E5E0D8; border-radius: 20px; padding: 0 10px; height: 28px; min-width: 140px; transition: border-color 80ms, box-shadow 80ms; }
        .search-box:focus-within { border-color: #1E40AF; box-shadow: 0 0 0 3px rgba(29,78,216,.12); }
        .search-box input { border: none; background: transparent; outline: none; font-size: 12px; color: #1F1B14; width: 100%; }

        /* Icon-only toolbar buttons */
        .tbtn-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 1px solid #E5E0D8; border-radius: 20px; background: #FFFFFF; color: #7A7158; cursor: pointer; transition: background 80ms, color 80ms; }
        .tbtn-icon:hover { background: #F5F1EB; color: #1F1B14; }

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
              onClick={handleExport}
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
              padding: '6px 14px 8px', fontSize: 14, fontWeight: 500,
              border: 'none', background: 'none', cursor: 'pointer',
              color: section === s.key ? '#1F1B14' : '#6B7280',
              borderBottom: section === s.key ? '2px solid #1F1B14' : '2px solid transparent',
              marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'color 100ms',
            }}>
              {s.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '1px 7px', borderRadius: 20,
                fontSize: 12, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                background: '#1F1B14',
                color: '#FFFFFF',
              }}>
                {s.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '6px 0', marginBottom: 10 }}>
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
          <button onClick={() => setChipImportacion(v => !v)} className={`chip${chipImportacion ? ' active' : ''}`}>
            Importación
            <span className="chip-count">{importacionCount}</span>
          </button>
          <button onClick={() => setChipExportacion(v => !v)} className={`chip${chipExportacion ? ' active' : ''}`}>
            Exportación
            <span className="chip-count">{exportacionCount}</span>
          </button>

          <div className="toolbar-sep" />

          <button onClick={() => setFiltrosOpen(v => !v)} className={`chip${filtrosOpen || filterDesde || filterHasta ? ' active' : ''}`}>
            <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filtros
            {(filterDesde || filterHasta) && <span className="chip-count">•</span>}
          </button>
          <div ref={sortRef} style={{ position: 'relative' }}>
            <button onClick={() => setSortOpen(v => !v)} className={`chip${sortOpen ? ' active' : ''}`}>
              <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Ordenar
            </button>
            {sortOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 4, minWidth: 220 }}>
                {([
                  { key: 'reciente', label: 'Más recientes primero' },
                  { key: 'antigua',  label: 'Más antiguas primero' },
                  { key: 'cliente',  label: 'Por cliente (A–Z)' },
                  { key: 'interno',  label: 'Por interno (mayor a menor)' },
                  { key: 'dias',     label: 'Por días sin liberar (mayor a menor)' },
                ] as { key: typeof sortKey; label: string }[]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { setSortKey(opt.key); setSortOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '7px 12px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', background: sortKey === opt.key ? '#1F1B14' : 'transparent', color: sortKey === opt.key ? '#FFFFFF' : '#1F1B14', fontWeight: sortKey === opt.key ? 500 : 400, transition: 'background 80ms', fontFamily: 'inherit' }}
                    onMouseEnter={e => { if (sortKey !== opt.key) e.currentTarget.style.background = '#F5F1EB' }}
                    onMouseLeave={e => { if (sortKey !== opt.key) e.currentTarget.style.background = 'transparent' }}
                  >
                    {opt.label}
                    {sortKey === opt.key && (
                      <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

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
          <div ref={moreRef} style={{ position: 'relative' }}>
            <button className="tbtn-icon" onClick={() => setMoreOpen(v => !v)} title="Más opciones">
              <svg style={{ width: 14, height: 14 }} fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {moreOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 8, boxShadow: '0 4px 16px rgba(31,27,20,.10)', padding: 4, minWidth: 200 }}>
                {([
                  {
                    label: 'Exportar Excel',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
                    onClick: () => { handleExport(); setMoreOpen(false) },
                  },
                  {
                    label: 'Exportar CSV',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
                    onClick: () => { handleExport(); setMoreOpen(false) },
                  },
                ] as { label: string; icon: React.ReactNode; onClick: () => void }[]).map(item => (
                  <button key={item.label} onClick={item.onClick}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent', color: '#1F1B14', fontWeight: 400, fontFamily: 'inherit', transition: 'background 80ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F5F1EB' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <svg style={{ width: 13, height: 13, flexShrink: 0, color: '#7A7158' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                    {item.label}
                  </button>
                ))}
                <div style={{ height: 1, background: '#E8DFC5', margin: '4px 0' }} />
                <button
                  onClick={() => { setSelectedIds(new Set(filtradas.map(op => op.id))); setMoreOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left', background: 'transparent', color: '#1F1B14', fontWeight: 400, fontFamily: 'inherit', transition: 'background 80ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F5F1EB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <svg style={{ width: 13, height: 13, flexShrink: 0, color: '#7A7158' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Seleccionar todas <span style={{ color: '#ADA482', marginLeft: 2 }}>({filtradas.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {filtrosOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#7A7158', fontWeight: 500, whiteSpace: 'nowrap' }}>Alta entre</span>
            <input
              type="date"
              value={filterDesde}
              onChange={e => setFilterDesde(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #E8DFC5', borderRadius: 5, color: '#1F1B14', background: '#FAFAF8', outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E8DFC5'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <span style={{ fontSize: 12, color: '#ADA482' }}>y</span>
            <input
              type="date"
              value={filterHasta}
              onChange={e => setFilterHasta(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #E8DFC5', borderRadius: 5, color: '#1F1B14', background: '#FAFAF8', outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#1E40AF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E8DFC5'; e.currentTarget.style.boxShadow = 'none' }}
            />
            {(filterDesde || filterHasta) && (
              <button
                onClick={() => { setFilterDesde(''); setFilterHasta('') }}
                style={{ fontSize: 12, color: '#7A7158', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F2ECDC'; e.currentTarget.style.color = '#1F1B14' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#7A7158' }}
              >
                Limpiar
              </button>
            )}
          </div>
        )}

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#3730A3' }}>
            <svg style={{ width: 13, height: 13, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span><strong>{selectedIds.size}</strong> fila{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}</span>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ marginLeft: 'auto', fontSize: 12, color: '#3730A3', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(55,48,163,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              Deseleccionar todo
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', background: '#FBDDD4', border: '1px solid #F9C7BB', borderRadius: 6, fontSize: 13, color: '#991B1B', marginBottom: 10 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ── Table card ── */}
        <div style={{ background: 'transparent', border: '1px solid #EDE9E3', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 0 rgba(31,27,20,.04), 0 1px 2px rgba(31,27,20,.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, color: '#1C1917', tableLayout: 'fixed', minWidth: 1200 }}>
              <colgroup>
                <col style={{ width: 4 }} />    {/* stripe */}
                <col style={{ width: 62 }} />   {/* interno */}
                <col style={{ width: 60 }} />   {/* recep */}
                <col style={{ width: 90 }} />   {/* cliente */}
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
                <col style={{ width: 96 }} />   {/* liberacion */}
                {innerTab === 'todas' && <col style={{ width: 90 }} />}
                <col style={{ width: 56 }} />   {/* action */}
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
                  <th style={{ ...TH, width: 80, padding: '8px 4px' }} className="st-action" />
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
                      <tr key={op.id} className="row-h" style={{ borderBottom: '1px solid #EDE9E3', height: 38 }}>

                        {/* Stripe — 3px inset shadow on left for atrasada rows */}
                        <td className="col-stripe" style={atrasada ? { boxShadow: 'inset 3px 0 0 #991B1B' } : undefined} />

                        {/* Interno — red if atrasada, blue otherwise */}
                        <td style={{ padding: '0 6px 0 8px', overflow: 'hidden', verticalAlign: 'middle' }} className="st-interno">
                          <div
                            className="interno-link"
                            onClick={() => setPanelOp(op)}
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: atrasada ? '#991B1B' : '#2563EB',
                              lineHeight: 1.2,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                            }}
                          >
                            {op.interno ?? '—'}
                            {hasBothTypes && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                color: (op.tipo ?? 'importacion') === 'importacion' ? '#1D4ED8' : '#15803D',
                                background: (op.tipo ?? 'importacion') === 'importacion' ? '#EFF6FF' : '#DCFCE7',
                                borderRadius: 4,
                                padding: '2px 6px',
                                lineHeight: 1,
                                marginTop: 2,
                                display: 'inline-block',
                              }}>
                                {(op.tipo ?? 'importacion') === 'importacion' ? 'IMPO' : 'EXPO'}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'recep_doc', DATE_STYLE)}
                        </td>

                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', fontWeight: 600, color: '#111827' }} className="st-cliente">
                          {renderCellLeft(op, 'cliente')}
                        </td>

                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderCell(op, 'oc')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderCell(op, 'factura')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderCell(op, 'crt')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderTransporteCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'fecha_pedido_fondos', DATE_STYLE)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderCell(op, 'senasa')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle' }} className="st-estado">
                          {renderSenasaCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'oficializacion', DATE_STYLE)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', color: '#374151' }}>
                          {renderCell(op, 'despacho')}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle' }}>
                          {renderCanalCell(op)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'aviso', DATE_STYLE)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'nota_entrega', DATE_STYLE)}
                        </td>
                        <td style={{ padding: '0 10px', overflow: 'hidden', verticalAlign: 'middle', ...DATE_STYLE }}>
                          {renderCell(op, 'liberacion', DATE_STYLE)}
                        </td>

                        {innerTab === 'todas' && (
                          <td style={{ padding: '0 10px', color: '#C4BDB5', overflow: 'hidden', fontSize: 11, verticalAlign: 'middle' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {op.created_by_email ?? '—'}
                            </span>
                          </td>
                        )}

                        <td style={{ padding: '0 4px', overflow: 'hidden', verticalAlign: 'middle' }} className="st-action">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                            {selectedIds.size > 0 && (
                              <input type="checkbox" checked={selectedIds.has(op.id)}
                                onChange={e => setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(op.id)
                                  else next.delete(op.id)
                                  return next
                                })}
                                style={{ width: 13, height: 13, accentColor: '#3730A3', cursor: 'pointer', flexShrink: 0 }}
                              />
                            )}
                            <button tabIndex={-1} onClick={() => setPanelOp(op)} title="Ver detalle" className="act-btn"
                              style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#7A7158', borderRadius: 4, display: 'flex', alignItems: 'center', opacity: selectedIds.size > 0 ? 1 : 0, transition: 'opacity 100ms, background 100ms' }}>
                              <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                            {op.liberacion && (
                              <button tabIndex={-1}
                                onClick={() => { if (!(op.mail_enviado ?? false)) setMailConfirmModal({ id: op.id, interno: op.interno }) }}
                                title={(op.mail_enviado ?? false) ? 'Mail enviado' : 'Enviar notificación'}
                                style={{ padding: 5, border: 'none', background: 'transparent', cursor: (op.mail_enviado ?? false) ? 'default' : 'pointer', color: (op.mail_enviado ?? false) ? '#16A34A' : '#9CA3AF', borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 100ms' }}>
                                <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </button>
                            )}
                            {userRol === 'superadmin' && (
                              <button tabIndex={-1} onClick={() => setDeleteConfirm({ id: op.id, interno: op.interno })} title="Eliminar operación" className="act-btn"
                                style={{ padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#991B1B', borderRadius: 4, display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 100ms, background 100ms' }}>
                                <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
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
                <input type="text" placeholder="DD/MM" value={senasaPopover.vinculacion}
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

      {mailConfirmModal && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)' }} onClick={() => !sendingMail && setMailConfirmModal(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 70, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 12, boxShadow: '0 8px 32px rgba(31,27,20,.18)', padding: '24px 28px', width: 360 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: 18, height: 18, color: '#1D4ED8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1F1B14' }}>¿Notificar al cliente?</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#4A4332', lineHeight: 1.5 }}>
                  Operación <strong>#{mailConfirmModal.interno ?? mailConfirmModal.id}</strong> fue liberada. ¿Deseas enviar la notificación al cliente?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMailConfirmModal(null)} disabled={sendingMail}
                style={{ padding: '7px 16px', fontSize: 13, border: '1px solid #E8DFC5', borderRadius: 6, background: '#FFFFFF', color: '#4A4332', cursor: sendingMail ? 'default' : 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!sendingMail) e.currentTarget.style.background = '#F5F1EB' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
              >
                No enviar ahora
              </button>
              <button
                onClick={async () => {
                  setSendingMail(true)
                  await enviarMailLiberacion(mailConfirmModal.id)
                  setSendingMail(false)
                  setMailConfirmModal(null)
                }}
                disabled={sendingMail}
                style={{ padding: '7px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: sendingMail ? '#3B5FA0' : '#1D4ED8', color: '#FFFFFF', cursor: sendingMail ? 'default' : 'pointer', fontWeight: 500, fontFamily: 'inherit', minWidth: 100 }}
              >
                {sendingMail ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </>
      )}

      {deleteConfirm && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)' }} onClick={() => !deleting && setDeleteConfirm(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 70, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 12, boxShadow: '0 8px 32px rgba(31,27,20,.18)', padding: '24px 28px', width: 360 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FBDDD4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg style={{ width: 18, height: 18, color: '#991B1B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1F1B14' }}>Eliminar operación</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#4A4332', lineHeight: 1.5 }}>
                  ¿Eliminar la operación <strong>#{deleteConfirm.interno ?? deleteConfirm.id}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '7px 16px', fontSize: 13, border: '1px solid #E8DFC5', borderRadius: 6, background: '#FFFFFF', color: '#4A4332', cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = '#F5F1EB' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
              >
                Cancelar
              </button>
              <button onClick={handleDeleteConfirmed} disabled={deleting}
                style={{ padding: '7px 16px', fontSize: 13, border: 'none', borderRadius: 6, background: deleting ? '#C9675E' : '#991B1B', color: '#FFFFFF', cursor: deleting ? 'default' : 'pointer', fontWeight: 500, fontFamily: 'inherit', minWidth: 100 }}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
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

      {panelOp && (
        <PanelDetalle op={panelOp} onClose={() => setPanelOp(null)} onSave={handlePanelSave} />
      )}
    </>
  )
}
