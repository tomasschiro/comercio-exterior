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

function KpiCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-none">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

const DONUT_COLORS = ['#22c55e', '#3b82f6', '#f59e0b']
const BLUE = '#3b82f6'

const ESTADO_ORDER = [
  'Pendiente',
  'En proceso',
  'Oficializado',
  'Avisado',
  'Nota de entrega',
  'Liberado',
] as const

const ESTADO_COLORS: Record<string, string> = {
  Pendiente: '#f59e0b',
  'En proceso': '#60a5fa',
  Oficializado: '#818cf8',
  Avisado: '#fb923c',
  'Nota de entrega': '#a78bfa',
  Liberado: '#22c55e',
}

export default function DashboardReportes({ operaciones }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  /* ── KPIs ─────────────────────────────────────────────────────────── */
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

  /* ── Alert: >3 sin liberar hace +10 días ─────────────────────────── */
  const alertCount = useMemo(() =>
    operaciones.filter(op => {
      if (op.liberacion || !op.recep_doc) return false
      return daysBetween(op.recep_doc, today) > 10
    }).length
  , [operaciones, today])

  /* ── Donut: 3 estados ────────────────────────────────────────────── */
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

  /* ── Top 5 clientes (barras horizontales) ────────────────────────── */
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

  /* ── Estado detallado (barras verticales) ────────────────────────── */
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

  /* ── Línea: operaciones por semana (últimas 8) ───────────────────── */
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

  /* ── Tabla: últimas 10 liberadas ─────────────────────────────────── */
  const ultimasLiberadas = useMemo(() =>
    operaciones
      .filter(op => op.liberacion)
      .sort((a, b) => new Date(b.liberacion!).getTime() - new Date(a.liberacion!).getTime())
      .slice(0, 10)
      .map(op => ({
        ...op,
        dias: op.recep_doc ? daysBetween(op.recep_doc, op.liberacion!) : null,
      }))
  , [operaciones])

  /* ── Tabla: sin liberar hace +7 días ─────────────────────────────── */
  const sinLiberarLargo = useMemo(() =>
    operaciones
      .filter(op => !op.liberacion && op.recep_doc && daysBetween(op.recep_doc, today) > 7)
      .sort((a, b) => new Date(a.recep_doc!).getTime() - new Date(b.recep_doc!).getTime())
      .map(op => ({
        ...op,
        diasAcum: daysBetween(op.recep_doc!, today),
      }))
  , [operaciones, today])

  return (
    <div className="space-y-6">

      {/* ── Banner de alerta ──────────────────────────────────────────── */}
      {alertCount > 3 && (
        <div className="bg-red-600 text-white rounded-xl px-6 py-4 flex items-start gap-3 shadow-lg">
          <svg className="w-6 h-6 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-bold text-base">
              {alertCount} operaciones sin liberar hace más de 10 días
            </p>
            <p className="text-red-100 text-sm mt-0.5">
              Revisá las operaciones en la tabla &quot;Sin liberar&quot; más abajo.
            </p>
          </div>
        </div>
      )}

      {/* ── Título ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Resumen y análisis de operaciones de comercio exterior
        </p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total operaciones" value={kpis.total} />
        <KpiCard label="Liberadas" value={kpis.liberadas} color="text-green-600" />
        <KpiCard label="% Liberadas" value={`${kpis.pct}%`} color="text-blue-600" />
        <KpiCard
          label="Sin liberar"
          value={kpis.sinLiberar}
          color={kpis.sinLiberar > 0 ? 'text-amber-600' : 'text-gray-900'}
        />
        <KpiCard
          label="Prom. días liberación"
          value={kpis.promedio !== null ? `${kpis.promedio} d` : '—'}
          sub="desde recep. hasta liberación"
          color="text-purple-600"
        />
      </div>

      {/* ── Gráficos ─────────────────────────────────────────────────── */}
      {mounted ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Donut */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Distribución por Estado</h2>
              {operaciones.length === 0 ? (
                <p className="text-sm text-gray-400 py-16 text-center">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={230} style={{ backgroundColor: '#FFFFFF' }}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top 5 clientes — barras horizontales */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Clientes</h2>
              {topClientes.length === 0 ? (
                <p className="text-sm text-gray-400 py-16 text-center">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height={230} style={{ backgroundColor: '#FFFFFF' }}>
                  <BarChart
                    data={topClientes}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="value" fill={BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Estado detallado — barras verticales */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Operaciones por Estado (detalle)</h2>
              <ResponsiveContainer width="100%" height={210} style={{ backgroundColor: '#FFFFFF' }}>
                <BarChart
                  data={porEstado}
                  margin={{ top: 0, right: 10, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {porEstado.map((entry) => (
                      <Cell key={entry.name} fill={ESTADO_COLORS[entry.name] ?? BLUE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Línea: por semana */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Operaciones Cargadas por Semana{' '}
                <span className="text-gray-400 font-normal">(últimas 8)</span>
              </h2>
              <ResponsiveContainer width="100%" height={210} style={{ backgroundColor: '#FFFFFF' }}>
                <LineChart
                  data={porSemana}
                  margin={{ top: 0, right: 10, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: TooltipValue | undefined) => [`${v ?? 0} operaciones`, '']}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={BLUE}
                    strokeWidth={2}
                    dot={{ r: 3, fill: BLUE }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-[280px] animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/3 mb-6" />
              <div className="h-full bg-gray-50 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ── Tablas ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimas 10 liberadas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Últimas 10 Liberadas</h2>
          </div>
          {ultimasLiberadas.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Sin operaciones liberadas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Interno</th>
                    <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2.5 text-left font-medium">Liberación</th>
                    <th className="px-4 py-2.5 text-right font-medium">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ultimasLiberadas.map(op => (
                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{op.interno ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{op.cliente ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(op.liberacion)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {op.dias !== null ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">
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
        </div>

        {/* Sin liberar +7 días */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Sin Liberar hace +7 días</h2>
            {sinLiberarLargo.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {sinLiberarLargo.length} pendientes
              </span>
            )}
          </div>
          {sinLiberarLargo.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              No hay operaciones pendientes hace +7 días
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Interno</th>
                    <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2.5 text-left font-medium">Recep. Doc</th>
                    <th className="px-4 py-2.5 text-right font-medium">Días acum.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sinLiberarLargo.map(op => (
                    <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{op.interno ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[140px] truncate">{op.cliente ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{fmt(op.recep_doc)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          op.diasAcum > 10
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {op.diasAcum} d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
