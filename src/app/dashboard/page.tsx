import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { getEstadoOperacion } from '@/types/database'
import type { Operacion } from '@/types/database'

// ── helpers ──────────────────────────────────────────────

function toDateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr + 'T12:00:00').getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── design tokens ────────────────────────────────────────

const PROGRESS: Record<string, number> = {
  'Pendiente': 5,
  'En proceso': 20,
  'Oficializado': 50,
  'Avisado': 65,
  'Nota de entrega': 82,
  'Liberado': 100,
}

const BADGE: Record<string, { bg: string; color: string }> = {
  'Liberado':         { bg: '#DCFCE7', color: '#16A34A' },
  'En proceso':       { bg: '#EFF6FF', color: '#2563EB' },
  'Oficializado':     { bg: '#F3E8FF', color: '#7C3AED' },
  'Avisado':          { bg: '#FEF3C7', color: '#D97706' },
  'Nota de entrega':  { bg: '#FEF3C7', color: '#D97706' },
  'Pendiente':        { bg: '#F4F4F5', color: '#6B6860' },
}

// ── page ─────────────────────────────────────────────────

export default async function DashboardPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: perfil }] = await Promise.all([
    admin.from('perfiles').select('rol').eq('id', user.id).single(),
  ])
  const userRol = perfil?.rol ?? 'operador'

  const d7  = toDateStr(7)
  const d15 = toDateStr(15)
  const d20 = toDateStr(20)

  const [
    { count: totalActivas },
    { count: liberadasSemana },
    { count: proximasCount },
    { count: demoradasCount },
    { data: ultimasOps },
    { data: liberadasReciente },
    { data: proximasSinLiberar },
  ] = await Promise.all([
    admin.from('operaciones')
      .select('*', { count: 'exact', head: true })
      .is('liberacion', null),

    admin.from('operaciones')
      .select('*', { count: 'exact', head: true })
      .gte('liberacion', d7),

    admin.from('operaciones')
      .select('*', { count: 'exact', head: true })
      .is('liberacion', null)
      .not('recep_doc', 'is', null)
      .lte('recep_doc', d15),

    admin.from('operaciones')
      .select('*', { count: 'exact', head: true })
      .is('liberacion', null)
      .not('recep_doc', 'is', null)
      .lte('recep_doc', d20),

    admin.from('operaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),

    admin.from('operaciones')
      .select('id,interno,cliente,despacho,liberacion')
      .not('liberacion', 'is', null)
      .order('liberacion', { ascending: false })
      .limit(5),

    admin.from('operaciones')
      .select('id,interno,cliente,despacho,recep_doc')
      .is('liberacion', null)
      .not('recep_doc', 'is', null)
      .order('recep_doc', { ascending: true })
      .limit(5),
  ])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <style>{`
        .kpi-card { transition: box-shadow 150ms, transform 150ms; }
        .kpi-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .op-row { transition: background 80ms; }
        .op-row:hover { background: #F4F4F5 !important; }
        .lib-row { transition: background 80ms; }
        .lib-row:hover { background: rgba(22,163,74,0.05); }
        .prox-row { transition: background 80ms; }
        .prox-row:hover { background: rgba(217,119,6,0.05); }
        .ver-link { color: #9C9A94; text-decoration: none; transition: color 100ms; }
        .ver-link:hover { color: #0D0D0D; }
        .ver-todas { font-size: 13px; color: #6B6860; text-decoration: none; font-weight: 500; transition: color 100ms; }
        .ver-todas:hover { color: #0D0D0D; }
        .cta-btn { display: flex; height: 56px; background: #18181B; border-radius: 8px; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: #FFFFFF; text-decoration: none; letter-spacing: -0.01em; transition: background 120ms; }
        .cta-btn:hover { background: #27272A; }
        @media (max-width: 900px) {
          .dash-cols { flex-direction: column !important; }
          .dash-left { flex: 1 1 auto !important; width: 100% !important; }
          .dash-right { flex: 1 1 auto !important; width: 100% !important; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .kpi-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <Header email={user.email} rol={userRol} />

      <main style={{ flex: 1, maxWidth: 1280, margin: '0 auto', width: '100%', padding: '32px 24px' }}>

        {/* ── Heading ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0D0D0D', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#9C9A94', margin: 0 }}>Resumen ejecutivo de operaciones</p>
        </div>

        {/* ── Section 1: KPIs ── */}
        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          <KpiCard label="Operaciones activas" value={totalActivas ?? 0} />
          <KpiCard label="Liberadas esta semana" value={liberadasSemana ?? 0} accent="green" />
          <KpiCard label="Próximas a liberar" value={proximasCount ?? 0} accent="yellow" note="+15 días" />
          <KpiCard label="Demoradas" value={demoradasCount ?? 0} accent="red" note="+20 días" />
        </div>

        {/* ── Section 2: Two columns ── */}
        <div className="dash-cols" style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>

          {/* Left 60%: últimas operaciones */}
          <div className="dash-left" style={{ flex: '0 0 60%', width: '60%' }}>
            <div style={{ background: '#FFFFFF', border: '0.5px solid #E8E5DE', borderRadius: 10, overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E8E5DE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D' }}>Últimas operaciones</span>
                <Link href="/operaciones" className="ver-link" style={{ fontSize: 12 }}>
                  Ver todas →
                </Link>
              </div>

              {/* Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Interno', 'Cliente', 'Despacho', 'Estado', 'Progreso'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px 8px',
                        fontSize: 11, fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#9C9A94',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ultimasOps ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', fontSize: 13, color: '#9C9A94' }}>
                        Sin operaciones registradas
                      </td>
                    </tr>
                  ) : (ultimasOps ?? []).map((op) => {
                    const est = getEstadoOperacion(op as unknown as Operacion)
                    const badge = BADGE[est] ?? BADGE['Pendiente']
                    const pct = PROGRESS[est] ?? 0
                    return (
                      <tr key={op.id} className="op-row" style={{ borderTop: '0.5px solid #F4F4F5', height: 44 }}>
                        <td style={{ padding: '0 16px' }}>
                          <Link href="/operaciones" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', height: 44 }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 12, color: op.interno ? '#0D0D0D' : '#D4D4D4' }}>
                              {op.interno ?? '—'}
                            </span>
                          </Link>
                        </td>
                        <td style={{ padding: '0 16px', maxWidth: 140 }}>
                          <span style={{ fontSize: 13, color: op.cliente ? '#0D0D0D' : '#D4D4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {op.cliente ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px' }}>
                          <span style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 12, color: op.despacho ? '#0D0D0D' : '#D4D4D4' }}>
                            {op.despacho ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: badge.bg, color: badge.color }}>
                            {est}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px 0 8px', minWidth: 88 }}>
                          <div style={{ height: 4, background: '#F4F4F5', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: pct === 100 ? '#16A34A' : '#18181B',
                              borderRadius: 2,
                            }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Card footer */}
              <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E8E5DE' }}>
                <Link href="/operaciones" className="ver-todas">
                  Ver todas las operaciones →
                </Link>
              </div>
            </div>
          </div>

          {/* Right 40%: two stacked cards */}
          <div className="dash-right" style={{ flex: '0 0 40%', width: '40%', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Card: Liberadas recientemente */}
            <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #BBF7D0' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>Liberadas recientemente</span>
              </div>
              {(liberadasReciente ?? []).length === 0 ? (
                <div style={{ padding: '24px 18px', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                  Sin operaciones liberadas
                </div>
              ) : (liberadasReciente ?? []).map((op, i) => (
                <div key={op.id} className="lib-row" style={{
                  padding: '10px 18px',
                  borderTop: i > 0 ? '0.5px solid #BBF7D0' : undefined,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 11, color: '#16A34A', minWidth: 32, flexShrink: 0 }}>
                    {op.interno ?? '—'}
                  </span>
                  <span style={{ fontSize: 12, color: '#15803D', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {op.cliente ?? '—'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtDate(op.liberacion)}
                  </span>
                </div>
              ))}
            </div>

            {/* Card: Próximas a liberar */}
            <div style={{ background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #FDE68A' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Próximas a liberar</span>
              </div>
              {(proximasSinLiberar ?? []).length === 0 ? (
                <div style={{ padding: '24px 18px', fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                  Sin operaciones pendientes
                </div>
              ) : (proximasSinLiberar ?? []).map((op, i) => {
                const dias = op.recep_doc ? daysSince(op.recep_doc) : 0
                const isLate = dias > 15
                return (
                  <div key={op.id} className="prox-row" style={{
                    padding: '10px 18px',
                    borderTop: i > 0 ? '0.5px solid #FDE68A' : undefined,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)', fontSize: 11, color: '#D97706', minWidth: 32, flexShrink: 0 }}>
                      {op.interno ?? '—'}
                    </span>
                    <span style={{ fontSize: 12, color: '#92400E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {op.cliente ?? '—'}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isLate ? '#DC2626' : '#D97706',
                      whiteSpace: 'nowrap', flexShrink: 0,
                      padding: '1px 5px', borderRadius: 3,
                      background: isLate ? '#FEF2F2' : 'transparent',
                    }}>
                      {dias}d
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Section 3: CTA ── */}
        <Link href="/operaciones" className="cta-btn">
          Ir al tablero de operaciones →
        </Link>

      </main>
    </div>
  )
}

// ── KPI card component ────────────────────────────────────

type KpiAccent = 'green' | 'yellow' | 'red'

const KPI_ACCENT: Record<KpiAccent, { value: string; noteBg: string; noteColor: string }> = {
  green:  { value: '#16A34A', noteBg: '#DCFCE7', noteColor: '#16A34A' },
  yellow: { value: '#D97706', noteBg: '#FEF3C7', noteColor: '#D97706' },
  red:    { value: '#DC2626', noteBg: '#FEF2F2', noteColor: '#DC2626' },
}

function KpiCard({ label, value, accent, note }: {
  label: string
  value: number
  accent?: KpiAccent
  note?: string
}) {
  const colors = accent ? KPI_ACCENT[accent] : null

  return (
    <div className="kpi-card" style={{
      background: '#FFFFFF',
      border: '0.5px solid #E8E5DE',
      borderRadius: 10,
      padding: '20px 20px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6B6860', lineHeight: 1.4 }}>{label}</span>
        {note && colors && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: '2px 6px', borderRadius: 4,
            background: colors.noteBg, color: colors.noteColor,
            whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0,
          }}>
            {note}
          </span>
        )}
      </div>
      <span style={{
        fontSize: 30, fontWeight: 700,
        color: colors?.value ?? '#0D0D0D',
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>
        {value}
      </span>
    </div>
  )
}
