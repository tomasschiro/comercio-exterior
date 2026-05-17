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

const ESTADO_COLORS: Record<string, string> = {
  'Liberado':   'bg-green-100 text-green-800',
  'En proceso': 'bg-blue-100 text-blue-800',
  'Pendiente':  'bg-yellow-100 text-yellow-700',
}

const SENASA_OPCIONES: { value: SenasaEstado; label: string; emoji: string }[] = [
  { value: 'pendiente', label: 'Pendiente', emoji: '⬜' },
  { value: 'retenida',  label: 'Retenida',  emoji: '🟡' },
  { value: 'liberada',  label: 'Liberada',  emoji: '🟢' },
  { value: 'vinculada', label: 'Vinculada', emoji: '🔵' },
]

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
      setTimeout(() => setCellStatus(id, field, null), 1000)
    } else {
      setCellStatus(id, field, 'success')
      setTimeout(() => setCellStatus(id, field, null), 1000)
    }
  }

  function openSenasaPopover(op: Operacion, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 188)
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

  function renderCell(op: Operacion, field: keyof Operacion) {
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
          className="w-full px-1.5 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          style={{ minWidth: inputType === 'date' ? 130 : 80 }}
        />
      )
    }

    let ringCls = ''
    if (status === 'saving') ringCls = 'bg-gray-50 ring-1 ring-inset ring-gray-300'
    if (status === 'success') ringCls = 'bg-green-50 ring-1 ring-inset ring-green-400'
    if (status === 'error')   ringCls = 'bg-red-50 ring-1 ring-inset ring-red-400'

    return (
      <div
        onClick={() => startEdit(op, field)}
        className={`flex items-center gap-1 rounded px-1 -mx-1 cursor-text min-h-[22px] transition-colors ${ringCls} ${!status ? 'hover:bg-blue-50' : ''}`}
      >
        <span className="truncate">{getDisplayValue(op, field)}</span>
        {status === 'saving' && (
          <svg className="animate-spin w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
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
      badge = <span className="text-gray-400">—</span>
    } else if (estado === 'retenida') {
      badge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Retenida</span>
    } else if (estado === 'liberada') {
      badge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Liberada</span>
    } else {
      badge = (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Vinculada{vinculacion ? ` ${formatDateShort(vinculacion)}` : ''}
        </span>
      )
    }

    return (
      <div
        onClick={e => openSenasaPopover(op, e)}
        className="flex items-center gap-1 rounded px-1 -mx-1 cursor-pointer min-h-[22px] hover:bg-blue-50 transition-colors"
      >
        {badge}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Operaciones</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Cargando...' : `${filtradas.length} registro${filtradas.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white">
            <button
              type="button"
              onClick={() => setTab('mis')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === 'mis'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mis operaciones
            </button>
            <button
              type="button"
              onClick={() => setTab('todas')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === 'todas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todas
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            onClick={cargarOperaciones}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

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

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Est. SENASA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Oficialización</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">N. Despacho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Aviso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Nota de entrega</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Liberación</th>
                {tab === 'todas' && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cargado por</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-12 text-center text-gray-400">
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
                  <td colSpan={totalCols} className="px-4 py-16 text-center">
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
                  const done = countDone(op)
                  const pct = (done / 10) * 100
                  const estado = getEstado(op)

                  return (
                    <tr key={op.id} className="group hover:bg-gray-50 transition-colors">
                      {/* Interno + progress bar */}
                      <td className="px-4 py-2 whitespace-nowrap" style={{ minWidth: 90 }}>
                        <div className="font-medium text-gray-900">
                          {renderCell(op, 'interno')}
                        </div>
                        <div
                          className="h-1 w-full bg-gray-100 rounded-full mt-1.5"
                          title={`${done} de 10 pasos completados`}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? '#22c55e' : pct > 0 ? '#93c5fd' : 'transparent',
                            }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" style={{ minWidth: 120 }}>
                        {renderCell(op, 'recep_doc')}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-[200px]">
                        {renderCell(op, 'cliente')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs" style={{ minWidth: 100 }}>
                        {renderCell(op, 'crt')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs" style={{ minWidth: 100 }}>
                        {renderCell(op, 'senasa')}
                      </td>

                      {/* EST. SENASA — popover selector */}
                      <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: 110 }}>
                        {renderSenasaEstadoCell(op)}
                      </td>

                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" style={{ minWidth: 120 }}>
                        {renderCell(op, 'oficializacion')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs" style={{ minWidth: 110 }}>
                        {renderCell(op, 'despacho')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" style={{ minWidth: 120 }}>
                        {renderCell(op, 'aviso')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" style={{ minWidth: 120 }}>
                        {renderCell(op, 'nota_entrega')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" style={{ minWidth: 120 }}>
                        {renderCell(op, 'liberacion')}
                      </td>

                      {tab === 'todas' && (
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs" style={{ minWidth: 140 }}>
                          {op.created_by_email ?? '—'}
                        </td>
                      )}

                      {/* Estado badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ESTADO_COLORS[estado]}`}>
                          {estado}
                        </span>
                      </td>

                      {/* Pencil — visible on row hover */}
                      <td className="px-2 py-3 whitespace-nowrap">
                        <button
                          onClick={() => setEditModalOp(op)}
                          title="Editar operación"
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* EST. SENASA Popover */}
      {senasaPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setSenasaPopover(null)}
          />
          <div
            style={{ position: 'fixed', top: senasaPopover.top, left: senasaPopover.left, zIndex: 50 }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-44"
          >
            <div className="flex flex-col gap-0.5">
              {SENASA_OPCIONES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSenasaPopover(prev => prev ? { ...prev, estado: opt.value } : null)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left
                    ${senasaPopover.estado === opt.value
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {senasaPopover.estado === 'vinculada' && (
              <div className="mt-2 px-1">
                <input
                  type="date"
                  value={senasaPopover.vinculacion}
                  onChange={e => setSenasaPopover(prev => prev ? { ...prev, vinculacion: e.target.value } : null)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={saveSenasaEstado}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
    </div>
  )
}
