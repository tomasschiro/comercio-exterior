'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Operacion, ReporteSemanal } from '@/types/database'
import { getEstadoOperacion } from '@/types/database'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'

type TooltipValue = number | string | ReadonlyArray<number | string>

interface Props {
  operaciones: Operacion[]
  userRol?: string
  reportesAnteriores?: ReporteSemanal[]
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + (a.includes('T') ? '' : 'T00:00:00'))
  const db = new Date(b + (b.includes('T') ? '' : 'T00:00:00'))
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

function fmt(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

// ── KPI Card ──────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, margin: '0 0 2px', color: color ?? 'var(--ink-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--ink-4)', margin: 0 }}>{sub}</p>}
    </div>
  )
}

// ── Chart Card wrapper ────────────────────────────────────

function ChartCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </div>
  )
}

// ── Table Card wrapper ────────────────────────────────────

function TableCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', margin: 0 }}>{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  )
}

// ── Table styles ──────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '8px 16px', textAlign: 'left',
  fontSize: 10, fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--ink-3)', background: 'var(--surface)',
  borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '8px 16px',
  borderTop: '1px solid var(--line)',
  fontSize: 12, color: 'var(--ink-2)',
}

// ── Data ──────────────────────────────────────────────────

const DONUT_COLORS = ['#166534', '#1E40AF', '#ADA482']
const ACCENT = '#1E40AF'

const ESTADO_ORDER = [
  'Pendiente', 'En proceso', 'Oficializado', 'Avisado', 'Nota de entrega', 'Liberado',
] as const

const ESTADO_COLORS: Record<string, string> = {
  Pendiente: '#ADA482',
  'En proceso': '#1E40AF',
  Oficializado: '#6D28D9',
  Avisado: '#92400E',
  'Nota de entrega': '#B45309',
  Liberado: '#166534',
}

// ── Main ──────────────────────────────────────────────────

export default function DashboardReportes({ operaciones, userRol, reportesAnteriores = [] }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [localReportes, setLocalReportes] = useState<ReporteSemanal[]>(reportesAnteriores)
  const [deleteReporteConfirm, setDeleteReporteConfirm] = useState<ReporteSemanal | null>(null)
  const [deletingReporte, setDeletingReporte] = useState(false)
  const [hoveredReporte, setHoveredReporte] = useState<number | null>(null)

  async function handleEnviarReporte() {
    setSending(true)
    setSendMsg(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setSendMsg({ ok: false, text: 'No hay sesión activa' }); return }
      const res = await fetch('/api/cron/reporte-semanal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as { emailSent?: boolean; uploadOk?: boolean; error?: string }
      if (res.ok) {
        const parts = ['Reporte generado']
        if (json.uploadOk) parts.push('y guardado en historial')
        if (json.emailSent) parts.push('· enviado por email')
        setSendMsg({ ok: true, text: parts.join(' ') })
        router.refresh()
      } else {
        setSendMsg({ ok: false, text: json.error ?? `Error ${res.status}` })
      }
    } catch (e) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : 'Error desconocido' })
    } finally {
      setSending(false)
    }
  }

  async function handleDescargarTodos() {
    setDownloadingAll(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const r of localReportes) {
        const res = await fetch(`/api/reportes/descargar?file=${encodeURIComponent(r.nombre_archivo)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json() as { url?: string; error?: string }
        if (json.url) {
          const pdfRes = await fetch(json.url)
          const blob = await pdfRes.blob()
          zip.file(r.nombre_archivo, blob)
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      const zipName = `Reportes_RMS_${dd}-${mm}-${yyyy}.zip`

      const objectUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = zipName
      a.click()
      URL.revokeObjectURL(objectUrl)
    } finally {
      setDownloadingAll(false)
    }
  }

  async function handleDescargar(nombreArchivo: string, idx: number) {
    setDownloading(idx)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`/api/reportes/descargar?file=${encodeURIComponent(nombreArchivo)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as { url?: string; error?: string }
      if (json.url) window.open(json.url, '_blank')
    } finally {
      setDownloading(null)
    }
  }

  async function handleEliminarReporte(reporte: ReporteSemanal) {
    setDeletingReporte(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/reportes/eliminar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: reporte.id, nombre_archivo: reporte.nombre_archivo }),
      })
      if (res.ok) {
        setLocalReportes(prev => prev.filter(r => r.id !== reporte.id))
        setDeleteReporteConfirm(null)
      }
    } finally {
      setDeletingReporte(false)
    }
  }

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  /* KPIs */
  const kpis = useMemo(() => {
    const total = operaciones.length
    const liberadasArr = operaciones.filter(op => op.liberacion)
    const sinLiberar = total - liberadasArr.length
    const pct = total > 0 ? (liberadasArr.length / total * 100).toFixed(1) : '0.0'
    const dias = liberadasArr
      .filter(op => op.recep_doc && op.liberacion)
      .map(op => daysBetween(op.recep_doc!, op.liberacion!))
      .filter(d => d >= 0)
    const promedio = dias.length > 0
      ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length)
      : null
    return { total, liberadas: liberadasArr.length, sinLiberar, pct, promedio }
  }, [operaciones])

  const alertCount = useMemo(() =>
    operaciones.filter(op => {
      if (op.liberacion || !op.recep_doc) return false
      return daysBetween(op.recep_doc, today) > 10
    }).length
  , [operaciones, today])

  const donutData = useMemo(() => {
    let liberado = 0, enProceso = 0, pendiente = 0
    operaciones.forEach(op => {
      const e = getEstadoOperacion(op)
      if (e === 'Liberado') liberado++
      else if (e === 'Pendiente') pendiente++
      else enProceso++
    })
    return [
      { name: 'Liberado', value: liberado },
      { name: 'En proceso', value: enProceso },
      { name: 'Pendiente', value: pendiente },
    ]
  }, [operaciones])

  const topClientes = useMemo(() => {
    const map: Record<string, number> = {}
    operaciones.forEach(op => {
      const c = op.cliente?.trim()
      if (c) map[c] = (map[c] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }))
  }, [operaciones])

  const porEstado = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      ESTADO_ORDER.map(e => [e, 0])
    )
    operaciones.forEach(op => {
      const e = getEstadoOperacion(op)
      counts[e] = (counts[e] || 0) + 1
    })
    return ESTADO_ORDER.map(name => ({ name, value: counts[name] }))
  }, [operaciones])

  const porSemana = useMemo(() => {
    const ref = new Date()
    ref.setHours(0, 0, 0, 0)
    return Array.from({ length: 8 }, (_, i) => {
      const weeksBack = 7 - i
      const wEnd = new Date(ref)
      wEnd.setDate(ref.getDate() - weeksBack * 7)
      wEnd.setHours(23, 59, 59, 999)
      const wStart = new Date(ref)
      wStart.setDate(ref.getDate() - weeksBack * 7 - 6)
      const label = `${wStart.getDate()}/${wStart.getMonth() + 1}`
      const value = operaciones.filter(op => {
        const d = new Date(op.created_at)
        return d >= wStart && d <= wEnd
      }).length
      return { name: label, value }
    })
  }, [operaciones])

  const ultimasLiberadas = useMemo(() =>
    operaciones
      .filter(op => op.liberacion)
      .sort((a, b) => new Date(b.liberacion!).getTime() - new Date(a.liberacion!).getTime())
      .slice(0, 10)
      .map(op => ({ ...op, dias: op.recep_doc ? daysBetween(op.recep_doc, op.liberacion!) : null }))
  , [operaciones])

  const sinLiberarLargo = useMemo(() =>
    operaciones
      .filter(op => !op.liberacion && op.recep_doc && daysBetween(op.recep_doc, today) > 7)
      .sort((a, b) => new Date(a.recep_doc!).getTime() - new Date(b.recep_doc!).getTime())
      .map(op => ({ ...op, diasAcum: daysBetween(op.recep_doc!, today) }))
  , [operaciones, today])

  const tickStyle = { fontSize: 11, fill: 'var(--ink-3)' }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Alert banner */}
      {alertCount > 3 && (
        <div style={{
          background: 'var(--bad)', color: '#FFFFFF',
          borderRadius: 'var(--radius-lg)', padding: '14px 20px',
          display: 'flex', alignItems: 'flex-start', gap: 12,
          boxShadow: 'var(--shadow-md)',
        }}>
          <svg style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>
              {alertCount} operaciones sin liberar hace más de 10 días
            </p>
            <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>
              Revisá las operaciones en la tabla &quot;Sin liberar&quot; más abajo.
            </p>
          </div>
        </div>
      )}

      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Reportes</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Resumen y análisis de operaciones de comercio exterior</p>
        </div>
        {userRol === 'superadmin' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={handleEnviarReporte}
              disabled={sending}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, cursor: sending ? 'not-allowed' : 'pointer',
                background: sending ? 'var(--surface-3)' : 'var(--ink-1)', color: sending ? 'var(--ink-3)' : '#FFFFFF',
                border: 'none', whiteSpace: 'nowrap', transition: 'background 120ms',
              }}
            >
              {sending ? 'Enviando…' : 'Enviar reporte ahora'}
            </button>
            {sendMsg && (
              <p style={{ fontSize: 12, margin: 0, color: sendMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>
                {sendMsg.text}
              </p>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KpiCard label="Total operaciones" value={kpis.total} />
        <KpiCard label="Liberadas" value={kpis.liberadas} color="var(--ok)" />
        <KpiCard label="% Liberadas" value={`${kpis.pct}%`} color="var(--accent-2)" />
        <KpiCard label="Sin liberar" value={kpis.sinLiberar} color={kpis.sinLiberar > 0 ? 'var(--warn)' : 'var(--ink-1)'} />
        <KpiCard label="Prom. días liberación" value={kpis.promedio !== null ? `${kpis.promedio} d` : '—'} sub="desde recep. hasta liberación" color="var(--info)" />
      </div>

      {/* Charts */}
      {mounted ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard title="Distribución por Estado">
              {operaciones.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '48px 0' }}>Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220} style={{ background: '#FFFFFF' }}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value">
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top 5 Clientes">
              {topClientes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '48px 0' }}>Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={220} style={{ background: '#FFFFFF' }}>
                  <BarChart data={topClientes} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)" />
                    <XAxis type="number" tick={tickStyle} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={tickStyle} tickLine={false} />
                    <Tooltip formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ChartCard title="Operaciones por Estado (detalle)">
              <ResponsiveContainer width="100%" height={200} style={{ background: '#FFFFFF' }}>
                <BarChart data={porEstado} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" tick={{ ...tickStyle, fontSize: 10 }} tickLine={false} />
                  <YAxis tick={tickStyle} allowDecimals={false} />
                  <Tooltip formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {porEstado.map(entry => <Cell key={entry.name} fill={ESTADO_COLORS[entry.name] ?? ACCENT} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={<>Operaciones Cargadas por Semana <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(últimas 8)</span></>}>
              <ResponsiveContainer width="100%" height={200} style={{ background: '#FFFFFF' }}>
                <LineChart data={porSemana} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="name" tick={tickStyle} tickLine={false} />
                  <YAxis tick={tickStyle} allowDecimals={false} />
                  <Tooltip formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={{ r: 3, fill: ACCENT }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 24, height: 280 }}>
              <div style={{ height: 10, background: 'var(--surface-3)', borderRadius: 4, width: '33%', marginBottom: 20 }} />
              <div style={{ height: '80%', background: 'var(--surface-2)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <TableCard title="Últimas 10 Liberadas">
          {ultimasLiberadas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '36px 0' }}>Sin operaciones liberadas</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Interno', 'Cliente', 'Liberación', 'Días'].map(h => (
                      <th key={h} style={{ ...TH, textAlign: h === 'Días' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ultimasLiberadas.map(op => (
                    <tr key={op.id}
                      style={{ transition: 'background 80ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)' }}>{op.interno ?? '—'}</td>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.cliente ?? '—'}</td>
                      <td style={TD}>{fmt(op.liberacion)}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {op.dias !== null ? (
                          <span style={{ padding: '2px 7px', borderRadius: 100, fontSize: 11, fontWeight: 500, background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                            {op.dias} d
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>

        <TableCard
          title="Sin Liberar hace +7 días"
          badge={sinLiberarLargo.length > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: 'var(--warn-bg)', color: 'var(--warn)' }}>
              {sinLiberarLargo.length} pendientes
            </span>
          ) : undefined}
        >
          {sinLiberarLargo.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '36px 0' }}>
              No hay operaciones pendientes hace +7 días
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Interno', 'Cliente', 'Recep. Doc', 'Días acum.'].map(h => (
                      <th key={h} style={{ ...TH, textAlign: h === 'Días acum.' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sinLiberarLargo.map(op => (
                    <tr key={op.id}
                      style={{ transition: 'background 80ms' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)' }}>{op.interno ?? '—'}</td>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.cliente ?? '—'}</td>
                      <td style={TD}>{fmt(op.recep_doc)}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                          background: op.diasAcum > 10 ? 'var(--bad-bg)' : 'var(--warn-bg)',
                          color: op.diasAcum > 10 ? 'var(--bad)' : 'var(--warn)',
                        }}>
                          {op.diasAcum} d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      </div>

      {/* Historial de reportes */}
      <TableCard
        title="Historial de reportes"
        badge={localReportes.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {localReportes.length > 1 && (
              <button
                onClick={handleDescargarTodos}
                disabled={downloadingAll}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 500,
                  borderRadius: 5, cursor: downloadingAll ? 'not-allowed' : 'pointer',
                  background: downloadingAll ? 'var(--surface-3)' : 'var(--ink-1)',
                  color: downloadingAll ? 'var(--ink-3)' : '#FFFFFF',
                  border: 'none', transition: 'background 120ms', whiteSpace: 'nowrap',
                }}
              >
                {downloadingAll ? 'Descargando…' : 'Descargar todos'}
              </button>
            )}
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
              {localReportes.length} reporte{localReportes.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : undefined}
      >
        {localReportes.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', padding: '36px 0' }}>
            No hay reportes generados aún
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Fecha', 'Archivo', 'Generado por', ''].map(h => (
                    <th key={h} style={{ ...TH, textAlign: h === '' ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localReportes.map((r, idx) => {
                  const [y, m, d] = r.fecha.split('-')
                  const fechaDisplay = `${d}/${m}/${y}`
                  return (
                    <tr key={r.id}
                      style={{ transition: 'background 80ms' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--row-hover)'; setHoveredReporte(r.id) }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setHoveredReporte(null) }}
                    >
                      <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap' }}>{fechaDisplay}</td>
                      <td style={{ ...TD, color: 'var(--ink-3)', fontFamily: 'monospace', fontSize: 11 }}>{r.nombre_archivo}</td>
                      <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.generado_por ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {userRol === 'superadmin' && (
                            <button
                              onClick={() => setDeleteReporteConfirm(r)}
                              title="Eliminar reporte"
                              style={{
                                padding: 5, border: 'none', background: 'transparent',
                                cursor: 'pointer', borderRadius: 4,
                                color: hoveredReporte === r.id ? 'var(--bad)' : 'transparent',
                                display: 'flex', alignItems: 'center', transition: 'color 100ms',
                              }}
                            >
                              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleDescargar(r.nombre_archivo, idx)}
                            disabled={downloading === idx}
                            style={{
                              padding: '4px 12px', fontSize: 11, fontWeight: 500,
                              borderRadius: 5, cursor: downloading === idx ? 'not-allowed' : 'pointer',
                              background: 'var(--surface-2)', color: 'var(--ink-2)',
                              border: '1px solid var(--line)', transition: 'background 120ms',
                            }}
                          >
                            {downloading === idx ? 'Generando…' : 'Descargar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
    </div>

    {/* Delete reporte confirmation modal */}
    {deleteReporteConfirm && (
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.35)' }}
          onClick={() => !deletingReporte && setDeleteReporteConfirm(null)}
        />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 70, background: '#FFFFFF', border: '1px solid #E8DFC5', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(31,27,20,.18)', padding: '24px 28px', width: 360,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 22, height: 22, color: 'var(--bad)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--ink-1)', textAlign: 'center' }}>
              ¿Eliminar este reporte?
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.5 }}>
              Esta acción no se puede deshacer.
            </p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all' }}>
              {deleteReporteConfirm.nombre_archivo}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setDeleteReporteConfirm(null)}
              disabled={deletingReporte}
              style={{
                padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6,
                background: 'var(--surface)', color: 'var(--ink-2)',
                border: '1px solid var(--line)', cursor: deletingReporte ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => handleEliminarReporte(deleteReporteConfirm)}
              disabled={deletingReporte}
              style={{
                padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 6,
                background: deletingReporte ? 'var(--surface-3)' : 'var(--bad)',
                color: deletingReporte ? 'var(--ink-3)' : '#FFFFFF',
                border: 'none', cursor: deletingReporte ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 120ms',
              }}
            >
              {deletingReporte ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </div>
      </>
    )}
    </>
  )
}
