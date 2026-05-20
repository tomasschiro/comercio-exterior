'use client'

import { useMemo, useState, useEffect } from 'react'
import type { Operacion } from '@/types/database'
import { getEstadoOperacion } from '@/types/database'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'

type TooltipValue = number | string | ReadonlyArray<number | string>

interface Props {
  operaciones: Operacion[]
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

export default function DashboardReportes({ operaciones }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Reportes</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Resumen y análisis de operaciones de comercio exterior</p>
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
    </div>
  )
}
