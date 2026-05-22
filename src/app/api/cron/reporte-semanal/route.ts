import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import type { Operacion } from '@/types/database'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Helpers ────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000
  )
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined || s === '') return '—'
  const str = String(s)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dayBadge(days: number): string {
  const cls = days < 5 ? 'bg' : days <= 10 ? 'by' : 'br'
  return `<span class="badge ${cls}">${days}d</span>`
}

// ── Email HTML ─────────────────────────────────────────────

function buildEmailHtml(data: {
  weekRange: string
  liberadas: number
  pendientes: number
  demoradas: number
  promedio: number | null
}): string {
  const bullet = (label: string, value: string | number) =>
    `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">&#8226; <strong>${label}:</strong> ${value}</p>`

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #E5E7EB;overflow:hidden;">
        <tr><td style="background:#1F1B14;padding:20px 32px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#FFFFFF;letter-spacing:0.04em;">RMS COMERCIO EXTERIOR</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            Resumen semanal — semana del <strong>${data.weekRange}</strong>
          </p>
          <div style="margin-bottom:24px;">
            ${bullet('Liberadas esta semana', data.liberadas)}
            ${bullet('Pendientes de liberar', data.pendientes)}
            ${bullet('Demoradas +10 días', data.demoradas)}
            ${bullet('Promedio días para liberar', data.promedio !== null ? `${data.promedio} días` : '—')}
          </div>
          <p style="margin:0;font-size:13px;color:#9CA3AF;font-style:italic;">
            El reporte completo se adjunta como PDF.
          </p>
        </td></tr>
        <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;">
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
            Saludos,<br><strong>RMS Comercio Exterior</strong>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── PDF HTML ───────────────────────────────────────────────

function buildPdfHtml(data: {
  todayIso: string
  todayDisplay: string
  weekRange: string
  weekStartStr: string
  ops: Operacion[]
  liberadasSemana: Operacion[]
  pendientes: Operacion[]
  demoradas: Operacion[]
  promedio: number | null
  cutoff: string
}): string {
  const { todayIso, todayDisplay, weekRange, ops, liberadasSemana, pendientes, demoradas, promedio, cutoff } = data

  const clientMap = new Map<string, { total: number; liberadas: number; pendientes: number }>()
  for (const op of ops) {
    const c = op.cliente ?? 'Sin cliente'
    const e = clientMap.get(c) ?? { total: 0, liberadas: 0, pendientes: 0 }
    e.total++
    if (op.liberacion && op.liberacion >= cutoff) e.liberadas++
    if (!op.liberacion) e.pendientes++
    clientMap.set(c, e)
  }
  const clientRows = Array.from(clientMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([c, s]) =>
      `<tr><td>${esc(c)}</td><td>${s.total}</td><td>${s.liberadas}</td><td>${s.pendientes}</td></tr>`
    ).join('')

  const respMap = new Map<string, { total: number; liberadas: number }>()
  for (const op of ops) {
    const r = op.created_by_email ?? 'Sin responsable'
    const e = respMap.get(r) ?? { total: 0, liberadas: 0 }
    e.total++
    if (op.liberacion && op.liberacion >= cutoff) e.liberadas++
    respMap.set(r, e)
  }
  const respRows = Array.from(respMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([r, s]) =>
      `<tr><td>${esc(r)}</td><td>${s.total}</td><td>${s.liberadas}</td></tr>`
    ).join('')

  const clientesActivos = new Set(pendientes.map(op => op.cliente ?? 'Sin cliente')).size

  const libRows = [...liberadasSemana]
    .sort((a, b) => (b.liberacion ?? '').localeCompare(a.liberacion ?? ''))
    .map(op => {
      const dias = op.recep_doc && op.liberacion ? daysBetween(op.recep_doc, op.liberacion) : null
      return `<tr>
        <td>${esc(op.interno)}</td><td>${esc(op.cliente)}</td><td>${esc(op.factura)}</td>
        <td>${esc(op.crt)}</td><td>${esc(op.transporte)}</td>
        <td>${fmtDate(op.recep_doc)}</td><td>${fmtDate(op.liberacion)}</td>
        <td>${dias !== null ? dayBadge(dias) : '—'}</td>
        <td>${esc(op.created_by_email)}</td>
      </tr>`
    }).join('')

  const pendRows = [...pendientes]
    .sort((a, b) => {
      const da = a.recep_doc ? daysBetween(a.recep_doc, todayIso) : -1
      const db = b.recep_doc ? daysBetween(b.recep_doc, todayIso) : -1
      return db - da
    })
    .map(op => {
      const dias = op.recep_doc ? daysBetween(op.recep_doc, todayIso) : null
      return `<tr>
        <td>${esc(op.interno)}</td><td>${esc(op.cliente)}</td><td>${esc(op.factura)}</td>
        <td>${esc(op.crt)}</td><td>${esc(op.transporte)}</td>
        <td>${fmtDate(op.recep_doc)}</td>
        <td>${dias !== null ? dayBadge(dias) : '—'}</td>
        <td>${esc(op.created_by_email)}</td>
      </tr>`
    }).join('')

  const pageHeader = (sub: string) => `
    <div class="ph">
      <span class="brand">RMS COMERCIO EXTERIOR</span>
      <span class="phdate">${sub}</span>
    </div>`

  const noData = (cols: number, msg = 'Sin operaciones') =>
    `<tr><td colspan="${cols}" style="color:#9CA3AF;text-align:center;padding:20px 8px;">${msg}</td></tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #FAF9F6;
    color: #374151;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: #FAF9F6;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .ph {
    background: #1F1B14;
    padding: 18px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand { font-size: 12px; font-weight: 700; color: #fff; letter-spacing: 0.06em; }
  .phdate { font-size: 10px; color: #9CA3AF; }
  .pc { padding: 28px 32px; }

  .report-title { margin-bottom: 24px; }
  .report-title h1 { font-size: 22px; font-weight: 800; color: #1F1B14; margin-bottom: 4px; }
  .report-title .sub { font-size: 12px; color: #6B7280; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .kpi {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 14px 18px;
  }
  .kpi .lbl {
    font-size: 9px;
    color: #9CA3AF;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .kpi .val {
    font-size: 28px;
    font-weight: 800;
    color: #1F1B14;
    line-height: 1;
  }
  .kpi .unit { font-size: 11px; color: #6B7280; font-weight: 400; margin-left: 3px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .sec-lbl {
    font-size: 9px;
    font-weight: 700;
    color: #1F1B14;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 2px solid #E5E7EB;
  }

  .sh { margin-bottom: 20px; }
  .sh h2 { font-size: 19px; font-weight: 800; color: #1F1B14; margin-bottom: 4px; }
  .sh .sub { font-size: 11px; color: #6B7280; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
  th {
    background: #1F1B14;
    color: #fff;
    text-align: left;
    padding: 7px 8px;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  td {
    padding: 6px 8px;
    border-bottom: 1px solid #F3F4F6;
    color: #374151;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tr:nth-child(even) td { background: #F9FAFB; }

  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 9px;
    white-space: nowrap;
  }
  .bg { background: #D1FAE5; color: #065F46; }
  .by { background: #FEF3C7; color: #92400E; }
  .br { background: #FEE2E2; color: #991B1B; }

  .red-val { color: #DC2626; }
</style>
</head>
<body>

<!-- PAGE 1 -->
<div class="page">
  ${pageHeader(todayDisplay)}
  <div class="pc">
    <div class="report-title">
      <h1>Reporte Semanal</h1>
      <div class="sub">Semana del ${weekRange}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="lbl">Total en sistema</div>
        <div class="val">${ops.length}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Liberadas esta semana</div>
        <div class="val">${liberadasSemana.length}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Pendientes</div>
        <div class="val">${pendientes.length}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Demoradas +10d</div>
        <div class="val${demoradas.length > 0 ? ' red-val' : ''}">${demoradas.length}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Promedio días</div>
        <div class="val">
          ${promedio !== null ? promedio : '—'}
          ${promedio !== null ? '<span class="unit">días</span>' : ''}
        </div>
      </div>
      <div class="kpi">
        <div class="lbl">Clientes activos</div>
        <div class="val">${clientesActivos}</div>
      </div>
    </div>

    <div class="two-col">
      <div>
        <div class="sec-lbl">Resumen por cliente</div>
        <table>
          <thead><tr><th>Cliente</th><th>Ops</th><th>Liberadas</th><th>Pendientes</th></tr></thead>
          <tbody>${clientRows || noData(4)}</tbody>
        </table>
      </div>
      <div>
        <div class="sec-lbl">Resumen por responsable</div>
        <table>
          <thead><tr><th>Usuario</th><th>A cargo</th><th>Liberadas</th></tr></thead>
          <tbody>${respRows || noData(3)}</tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  ${pageHeader('Operaciones liberadas esta semana')}
  <div class="pc">
    <div class="sh">
      <h2>Operaciones liberadas esta semana</h2>
      <div class="sub">${liberadasSemana.length} operación${liberadasSemana.length !== 1 ? 'es' : ''} — semana del ${weekRange}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Interno</th><th>Cliente</th><th>Factura</th><th>CRT</th>
          <th>Transporte</th><th>Recep.</th><th>Liberación</th><th>Días</th><th>Responsable</th>
        </tr>
      </thead>
      <tbody>${libRows || noData(9, 'Sin operaciones liberadas esta semana')}</tbody>
    </table>
  </div>
</div>

<!-- PAGE 3 -->
<div class="page">
  ${pageHeader('Operaciones pendientes')}
  <div class="pc">
    <div class="sh">
      <h2>Operaciones pendientes</h2>
      <div class="sub">${pendientes.length} operación${pendientes.length !== 1 ? 'es' : ''} — ordenadas por urgencia</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Interno</th><th>Cliente</th><th>Factura</th><th>CRT</th>
          <th>Transporte</th><th>Recep.</th><th>Días acum.</th><th>Responsable</th>
        </tr>
      </thead>
      <tbody>${pendRows || noData(8, 'Sin operaciones pendientes')}</tbody>
    </table>
  </div>
</div>

</body>
</html>`
}

// ── PDF generation ─────────────────────────────────────────

async function generatePdf(html: string): Promise<Buffer> {
  chromium.setGraphicsMode = false

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const raw = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
  } finally {
    await browser.close()
  }
}

// ── Core report logic ──────────────────────────────────────

async function runReporte(triggeredBy = 'Cron automático'): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey)

  const { data: operaciones, error: opError } = await admin.from('operaciones').select('*')
  if (opError) {
    return NextResponse.json({ error: opError.message }, { status: 500 })
  }

  const ops = (operaciones ?? []) as Operacion[]
  const todayIso = new Date().toISOString().split('T')[0]

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff = sevenDaysAgo.toISOString().split('T')[0]

  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const todayDisplay = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`
  const weekStartStr = `${pad(sevenDaysAgo.getDate())}/${pad(sevenDaysAgo.getMonth() + 1)}`
  const weekRange = `${weekStartStr} — ${todayDisplay}`
  const dateStr = todayIso.split('-').reverse().join('-')

  const liberadasSemana = ops.filter(op => op.liberacion && op.liberacion >= cutoff)
  const pendientes = ops.filter(op => !op.liberacion)
  const demoradas = pendientes.filter(op => op.recep_doc && daysBetween(op.recep_doc, todayIso) > 10)

  const diasArr = ops
    .filter(op => op.liberacion && op.recep_doc)
    .map(op => daysBetween(op.recep_doc!, op.liberacion!))
    .filter(d => d >= 0)
  const promedio = diasArr.length > 0
    ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length)
    : null

  const html = buildPdfHtml({
    todayIso, todayDisplay, weekRange, weekStartStr,
    ops, liberadasSemana, pendientes, demoradas, promedio, cutoff,
  })

  const pdfBuffer = await generatePdf(html)

  // Get superadmin emails for sending
  const { data: admins } = await admin
    .from('perfiles')
    .select('email')
    .eq('rol', 'superadmin')
  const to = ((admins ?? []) as { email: string }[]).map(a => a.email).filter(Boolean)

  // Upload to Supabase Storage (private bucket)
  const fileName = `Reporte_RMS_${dateStr}.pdf`
  let uploadOk = false

  const { error: bucketErr } = await admin.storage.createBucket('reportes', { public: false })
  if (bucketErr && !bucketErr.message.toLowerCase().includes('already exist')) {
    console.error('[Storage] bucket create error:', bucketErr.message)
  }

  const { error: uploadErr } = await admin.storage
    .from('reportes')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    console.error('[Storage] upload error:', uploadErr.message)
  } else {
    uploadOk = true
    const { error: insertErr } = await admin.from('reportes_semanales').insert({
      fecha: todayIso,
      nombre_archivo: fileName,
      generado_por: triggeredBy,
    })
    if (insertErr) console.error('[Storage] insert error:', insertErr.message)
  }

  // Send email
  let emailSent = false
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey !== 'placeholder' && to.length > 0) {
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: 'RMS Comercio Exterior <info@rodolfoschiro.com.ar>',
      to,
      subject: `Reporte semanal RMS — Semana del ${weekStartStr}`,
      html: buildEmailHtml({ weekRange, liberadas: liberadasSemana.length, pendientes: pendientes.length, demoradas: demoradas.length, promedio }),
      attachments: [{ filename: fileName, content: pdfBuffer }],
    })
    emailSent = true
  }

  return NextResponse.json({ success: true, emailSent, uploadOk, nombreArchivo: fileName })
}

// ── GET — Vercel cron ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await runReporte('Cron automático')
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — manual trigger by superadmin ───────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const anonClient = createClient(url, anonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminCheck = createClient(url, serviceKey)
    const { data: perfil } = await adminCheck
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return await runReporte(user.email ?? 'Superadmin')
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
