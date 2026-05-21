'use client'

import { useState, useEffect } from 'react'
import type { Operacion } from '@/types/database'

type PanelTab = 'detalle' | 'documentos' | 'actividad' | 'notas'

interface StageFieldDef {
  key: keyof Operacion
  label: string
  type: 'text' | 'date' | 'number' | 'senasa_estado' | 'canal'
}

interface StageDef {
  key: string
  label: string
  fields: StageFieldDef[]
  isComplete: (op: Operacion) => boolean
  isRetenida?: (op: Operacion) => boolean
  completionDate: (op: Operacion) => string | null | undefined
}

const STAGES: StageDef[] = [
  {
    key: 'recepcion',
    label: 'Recepción',
    fields: [{ key: 'recep_doc', label: 'Fecha recepción', type: 'date' }],
    isComplete: op => !!op.recep_doc,
    completionDate: op => op.recep_doc,
  },
  {
    key: 'documentos',
    label: 'Documentos',
    fields: [
      { key: 'oc', label: 'OC', type: 'text' },
      { key: 'factura', label: 'Factura', type: 'text' },
      { key: 'crt', label: 'CRT', type: 'text' },
    ],
    isComplete: op => !!(op.oc && op.factura && op.crt),
    completionDate: () => null,
  },
  {
    key: 'pago',
    label: 'Pedido de fondos',
    fields: [{ key: 'fecha_pedido_fondos', label: 'Fecha pedido', type: 'date' }],
    isComplete: op => !!op.fecha_pedido_fondos,
    completionDate: op => op.fecha_pedido_fondos,
  },
  {
    key: 'senasa',
    label: 'SENASA',
    fields: [
      { key: 'senasa', label: 'Nº SENASA', type: 'text' },
      { key: 'senasa_estado', label: 'Estado', type: 'senasa_estado' },
      { key: 'senasa_vinculacion', label: 'Fecha vinculación', type: 'date' },
    ],
    isComplete: op => !!(op.senasa && op.senasa_estado && op.senasa_estado !== 'retenida'),
    isRetenida: op => op.senasa_estado === 'retenida',
    completionDate: op => op.senasa_vinculacion,
  },
  {
    key: 'oficializacion',
    label: 'Oficialización',
    fields: [{ key: 'oficializacion', label: 'Fecha oficialización', type: 'date' }],
    isComplete: op => !!op.oficializacion,
    completionDate: op => op.oficializacion,
  },
  {
    key: 'despacho',
    label: 'Despacho',
    fields: [
      { key: 'despacho', label: 'Nº despacho', type: 'text' },
      { key: 'canal', label: 'Canal', type: 'canal' },
    ],
    isComplete: op => !!op.despacho,
    completionDate: () => null,
  },
  {
    key: 'entrega',
    label: 'Entrega',
    fields: [
      { key: 'aviso', label: 'Aviso de carga', type: 'date' },
      { key: 'nota_entrega', label: 'Nota de entrega', type: 'date' },
    ],
    isComplete: op => !!(op.aviso && op.nota_entrega),
    completionDate: op => op.nota_entrega || op.aviso,
  },
  {
    key: 'liberacion',
    label: 'Liberación',
    fields: [{ key: 'liberacion', label: 'Fecha liberación', type: 'date' }],
    isComplete: op => !!op.liberacion,
    completionDate: op => op.liberacion,
  },
]

function getProximoPaso(op: Operacion): string | null {
  if (!op.recep_doc) return 'Cargar fecha de recepción de documentos'
  if (!op.oc || !op.factura || !op.crt) return 'Completar documentos (OC, factura y CRT)'
  if (!op.fecha_pedido_fondos) return 'Registrar pedido de fondos'
  if (!op.senasa) return 'Tramitar SENASA'
  if (op.senasa_estado === 'retenida') return 'Responder observación SENASA'
  if (!op.oficializacion) return 'Registrar fecha de oficialización'
  if (!op.despacho) return 'Cargar número de despacho'
  if (!op.aviso) return 'Registrar aviso de carga'
  if (!op.nota_entrega) return 'Cargar nota de entrega'
  if (!op.liberacion) return 'Registrar fecha de liberación'
  return null
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function getCurrentStageIndex(op: Operacion): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (!STAGES[i].isComplete(op)) return i
  }
  return STAGES.length
}

const CANAL_LABELS: Record<string, string> = { V: 'Verde', R: 'Rojo', N: 'Naranja', A: 'Amarillo' }
const SENASA_LABELS: Record<string, string> = { pendiente: 'Pendiente', retenida: 'Retenida', liberada: 'Liberada', vinculada: 'Vinculada' }

interface Props {
  op: Operacion
  onClose: () => void
  onSave: (updated: Operacion) => Promise<void>
}

export default function PanelDetalle({ op, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>('detalle')
  const [localOp, setLocalOp] = useState<Operacion>(op)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editingField, setEditingField] = useState<keyof Operacion | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setLocalOp(op)
    setDirty(false)
    setSaveError('')
  }, [op])

  function toggleCollapse(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function setField(field: keyof Operacion, value: string | number | null) {
    setLocalOp(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      await onSave(localOp)
      setDirty(false)
    } catch {
      setSaveError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setLocalOp(op)
    setDirty(false)
    onClose()
  }

  const proximoPaso = getProximoPaso(localOp)
  const currentStageIdx = getCurrentStageIndex(localOp)

  const estadoBadge = localOp.liberacion
    ? { label: 'Liberado', bg: '#E1F1D6', color: '#166534' }
    : currentStageIdx > 0
    ? { label: 'En proceso', bg: '#D6E1FB', color: '#1E40AF' }
    : { label: 'Pendiente', bg: '#FCEBC4', color: '#92400E' }

  function renderFieldValue(field: StageFieldDef) {
    const rawVal = localOp[field.key]
    const isEditing = editingField === field.key

    if (isEditing) {
      if (field.type === 'senasa_estado') {
        return (
          <select
            autoFocus
            value={(rawVal as string) ?? ''}
            onChange={e => setField(field.key, e.target.value || null)}
            onBlur={() => setEditingField(null)}
            style={{ fontSize: 13, border: '1px solid #1E40AF', borderRadius: 4, padding: '2px 6px', outline: 'none', background: '#FFFFFF', color: '#1F1B14', boxShadow: '0 0 0 3px rgba(29,78,216,.12)' }}
          >
            <option value="">— Sin estado —</option>
            <option value="pendiente">Pendiente</option>
            <option value="retenida">Retenida</option>
            <option value="liberada">Liberada</option>
            <option value="vinculada">Vinculada</option>
          </select>
        )
      }
      if (field.type === 'canal') {
        return (
          <select
            autoFocus
            value={(rawVal as string) ?? ''}
            onChange={e => setField(field.key, e.target.value || null)}
            onBlur={() => setEditingField(null)}
            style={{ fontSize: 13, border: '1px solid #1E40AF', borderRadius: 4, padding: '2px 6px', outline: 'none', background: '#FFFFFF', color: '#1F1B14', boxShadow: '0 0 0 3px rgba(29,78,216,.12)' }}
          >
            <option value="">— Sin canal —</option>
            <option value="V">Verde</option>
            <option value="R">Rojo</option>
            <option value="N">Naranja</option>
            <option value="A">Amarillo</option>
          </select>
        )
      }
      return (
        <input
          autoFocus
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={(rawVal as string) ?? ''}
          maxLength={field.key === 'despacho' ? 11 : field.key === 'senasa' ? 7 : field.key === 'crt' ? 9 : undefined}
          onChange={e => {
            let v = e.target.value
            if (field.key === 'despacho') v = v.toUpperCase().slice(0, 11)
            else if (field.key === 'senasa') v = v.replace(/\D/g, '').slice(0, 7)
            else if (field.key === 'crt') v = v.replace(/\D/g, '').slice(0, 9)
            setField(field.key, v || null)
          }}
          onBlur={() => setEditingField(null)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setEditingField(null) } }}
          style={{ fontSize: 13, border: '1px solid #1E40AF', borderRadius: 4, padding: '2px 6px', outline: 'none', background: '#FFFFFF', color: '#1F1B14', boxShadow: '0 0 0 3px rgba(29,78,216,.12)', minWidth: field.type === 'date' ? 120 : 80, ...(field.key === 'despacho' ? { textTransform: 'uppercase' as const } : {}) }}
        />
      )
    }

    let display: React.ReactNode = <span style={{ color: '#ADA482' }}>—</span>
    if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
      if (field.type === 'date') {
        display = <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{formatDate(rawVal as string)}</span>
      } else if (field.type === 'senasa_estado') {
        const label = SENASA_LABELS[rawVal as string] ?? String(rawVal)
        const colors: Record<string, { bg: string; color: string }> = {
          retenida: { bg: '#FBDDD4', color: '#991B1B' },
          liberada: { bg: '#E1F1D6', color: '#166534' },
          vinculada: { bg: '#E0E4FB', color: '#3730A3' },
          pendiente: { bg: '#FCEBC4', color: '#92400E' },
        }
        const c = colors[rawVal as string] ?? { bg: '#ECE5D2', color: '#4A4332' }
        display = <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{label}</span>
      } else if (field.type === 'canal') {
        const label = CANAL_LABELS[rawVal as string] ?? String(rawVal)
        const colors: Record<string, { bg: string; color: string }> = {
          V: { bg: '#E1F1D6', color: '#166534' },
          R: { bg: '#FBDDD4', color: '#991B1B' },
          N: { bg: '#FDE6CB', color: '#9A3412' },
          A: { bg: '#FCEBC4', color: '#92400E' },
        }
        const c = colors[rawVal as string] ?? { bg: '#ECE5D2', color: '#4A4332' }
        display = <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: c.bg, color: c.color }}>{label}</span>
      } else {
        display = <span style={{ fontFamily: field.type === 'number' ? 'ui-monospace, monospace' : undefined }}>{String(rawVal)}</span>
      }
    }

    return (
      <span
        onClick={() => setEditingField(field.key)}
        style={{ cursor: 'text', padding: '1px 4px', borderRadius: 3, transition: 'background 80ms', display: 'inline-flex', alignItems: 'center', minHeight: 22 }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(31,27,20,.05)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {display}
      </span>
    )
  }

  function stageIcon(stage: StageDef, idx: number) {
    const complete = stage.isComplete(localOp)
    const retenida = stage.isRetenida?.(localOp)
    const isCurrent = idx === currentStageIdx
    let bg = '#E8DFC5'
    let border = '#E8DFC5'
    let content: React.ReactNode = null

    if (retenida) {
      bg = '#FBDDD4'; border = '#991B1B'
      content = <span style={{ color: '#991B1B', fontSize: 10, fontWeight: 700 }}>!</span>
    } else if (complete) {
      bg = '#E1F1D6'; border = '#166534'
      content = (
        <svg style={{ width: 10, height: 10, color: '#166534' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )
    } else if (isCurrent) {
      bg = '#D6E1FB'; border = '#1E40AF'
      content = <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1E40AF', display: 'block' }} />
    }

    return (
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${border}`, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {content}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(31,27,20,0.35)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
          background: '#FFFFFF',
          boxShadow: '0 12px 32px rgba(31,27,20,.14), 0 4px 8px rgba(31,27,20,.08)',
          zIndex: 51,
          display: 'flex', flexDirection: 'column',
          animation: 'panelSlideIn 220ms cubic-bezier(.4,0,.2,1)',
        }}
      >
        <style>{`
          @keyframes panelSlideIn {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E8DFC5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, fontWeight: 700, color: '#1F1B14', letterSpacing: '-0.02em' }}>
                  #{localOp.interno ?? '—'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: estadoBadge.bg, color: estadoBadge.color }}>
                  {estadoBadge.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#4A4332' }}>
                {localOp.cliente ?? <span style={{ color: '#ADA482' }}>Sin cliente</span>}
                {localOp.recep_doc && (
                  <span style={{ color: '#ADA482', marginLeft: 8 }}>· Recep. {formatDate(localOp.recep_doc)}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleCancel}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ADA482', padding: 4, borderRadius: 4, transition: 'color 100ms, background 100ms', display: 'flex' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#1F1B14'; e.currentTarget.style.background = '#F2ECDC' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ADA482'; e.currentTarget.style.background = 'transparent' }}
            >
              <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['detalle', 'documentos', 'actividad', 'notas'] as PanelTab[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: '8px 14px', fontSize: 13, fontWeight: activeTab === t ? 600 : 400,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: activeTab === t ? '#1F1B14' : '#7A7158',
                  borderBottom: activeTab === t ? '2px solid #1F1B14' : '2px solid transparent',
                  transition: 'color 100ms',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'detalle' ? (
            <>
              {/* Próximo paso banner */}
              {proximoPaso && !localOp.liberacion && (
                <div style={{ background: '#EDF1FF', border: '1px solid #C7D4FB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg style={{ width: 14, height: 14, color: '#1E40AF', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span style={{ fontSize: 12.5, color: '#1E40AF', fontWeight: 500 }}>Próximo paso: {proximoPaso}</span>
                </div>
              )}

              {/* Stage groups */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {STAGES.map((stage, idx) => {
                  const complete = stage.isComplete(localOp)
                  const retenida = stage.isRetenida?.(localOp)
                  const isCurrent = idx === currentStageIdx
                  const isOpen = !collapsed[stage.key]

                  let subLabel = ''
                  const dateStr = stage.completionDate(localOp)
                  if (complete && dateStr) subLabel = `Completada · ${formatDate(dateStr)}`
                  else if (complete) subLabel = 'Completada'
                  else if (retenida) subLabel = 'Retenida — requiere acción'
                  else if (isCurrent) subLabel = 'En curso'
                  else subLabel = 'Pendiente'

                  return (
                    <div
                      key={stage.key}
                      style={{ border: '1px solid #E8DFC5', borderRadius: 8, overflow: 'hidden', background: retenida ? '#FFFBFB' : '#FFFFFF' }}
                    >
                      <button
                        onClick={() => toggleCollapse(stage.key)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        {stageIcon(stage, idx)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1F1B14' }}>{stage.label}</div>
                          <div style={{ fontSize: 11, color: retenida ? '#991B1B' : isCurrent ? '#1E40AF' : complete ? '#166534' : '#ADA482' }}>{subLabel}</div>
                        </div>
                        <svg
                          style={{ width: 14, height: 14, color: '#ADA482', transition: 'transform 150ms', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div style={{ borderTop: '1px solid #E8DFC5', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {stage.fields.map(field => {
                            const rawVal = localOp[field.key]
                            const hasValue = rawVal !== null && rawVal !== undefined && rawVal !== ''
                            if (field.key === 'senasa_vinculacion' && localOp.senasa_estado !== 'vinculada') return null
                            return (
                              <div key={String(field.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>
                                <span style={{ fontSize: 12, color: '#7A7158', flexShrink: 0 }}>{field.label}</span>
                                <div style={{ fontSize: 13, color: hasValue ? '#1F1B14' : '#ADA482' }}>
                                  {renderFieldValue(field)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <svg style={{ width: 28, height: 28, color: '#E8DFC5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ fontSize: 13, color: '#ADA482', margin: 0 }}>Próximamente</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8DFC5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#FFFFFF' }}>
          <div>
            {saveError && <span style={{ fontSize: 12, color: '#991B1B' }}>{saveError}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCancel}
              style={{ padding: '0 16px', height: 32, fontSize: 13, border: '1px solid #E8DFC5', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#7A7158', transition: 'background 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F2ECDC' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {dirty ? 'Descartar' : 'Cerrar'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              style={{ padding: '0 16px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: saving || !dirty ? '#ADA482' : '#1F1B14', border: 'none', borderRadius: 6, cursor: saving || !dirty ? 'default' : 'pointer', transition: 'background 120ms' }}
              onMouseEnter={e => { if (!saving && dirty) e.currentTarget.style.background = '#111008' }}
              onMouseLeave={e => { if (!saving && dirty) e.currentTarget.style.background = '#1F1B14' }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
