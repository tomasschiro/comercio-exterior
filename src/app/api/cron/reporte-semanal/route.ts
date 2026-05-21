import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as XLSX from 'xlsx'
import { createSign } from 'crypto'
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

// ── Google Drive upload via service account JWT ────────────

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sigInput = `${header}.${body}`
  const sign = createSign('RSA-SHA256')
  sign.update(sigInput)
  const signature = sign.sign(privateKey.replace(/\\n/g, '\n'), 'base64url')
  const jwt = `${sigInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json() as { access_token: string }
  return data.access_token
}

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: Buffer
): Promise<string | null> {
  const boundary = 'rms_reporte_boundary'
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Transfer-Encoding: base64',
    '',
    content.toString('base64'),
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  const data = await res.json() as { id?: string }
  return data.id ?? null
}

// ── Email HTML ─────────────────────────────────────────────

function buildEmailHtml(data: {
  weekStart: string
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
        <tr>
          <td style="background:#1F1B14;padding:20px 32px;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#FFFFFF;letter-spacing:0.04em;">RMS COMERCIO EXTERIOR</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Resumen semanal — semana del <strong>${data.weekStart}</strong>
            </p>
            <div style="margin-bottom:24px;">
              ${bullet('Liberadas esta semana', data.liberadas)}
              ${bullet('Pendientes de liberar', data.pendientes)}
              ${bullet('Demoradas +10 días', data.demoradas)}
              ${bullet('Promedio días para liberar', data.promedio !== null ? `${data.promedio} días` : '—')}
            </div>
            <p style="margin:0;font-size:13px;color:#9CA3AF;font-style:italic;">
              El reporte completo se adjunta como archivo Excel.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;">
            <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
              Saludos,<br><strong>RMS Comercio Exterior</strong>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Core report logic ──────────────────────────────────────

async function runReporte(): Promise<NextResponse> {
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
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff = sevenDaysAgo.toISOString().split('T')[0]

  const liberadasSemana = ops.filter(op => op.liberacion && op.liberacion >= cutoff)
  const pendientes = ops.filter(op => !op.liberacion)
  const demoradas = pendientes.filter(
    op => op.recep_doc && daysBetween(op.recep_doc, today) > 10
  )
  const diasArr = ops
    .filter(op => op.liberacion && op.recep_doc)
    .map(op => daysBetween(op.recep_doc!, op.liberacion!))
    .filter(d => d >= 0)
  const promedio =
    diasArr.length > 0
      ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length)
      : null

  // Build Excel
  const wb = XLSX.utils.book_new()

  const wsResumen = XLSX.utils.aoa_to_sheet([
    ['KPI', 'Valor'],
    ['Total activas', pendientes.length],
    ['Liberadas esta semana', liberadasSemana.length],
    ['Pendientes de liberar', pendientes.length],
    ['Demoradas +10 días', demoradas.length],
    ['Promedio días para liberar', promedio ?? '—'],
  ])
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  const wsLib = XLSX.utils.aoa_to_sheet([
    ['Interno', 'Cliente', 'Factura', 'CRT', 'Transporte', 'Fecha recep.', 'Fecha liberación', 'Días que tardó', 'Responsable'],
    ...liberadasSemana.map(op => [
      op.interno ?? '—',
      op.cliente ?? '—',
      op.factura ?? '—',
      op.crt ?? '—',
      op.transporte ?? '—',
      fmtDate(op.recep_doc),
      fmtDate(op.liberacion),
      op.recep_doc && op.liberacion ? daysBetween(op.recep_doc, op.liberacion) : '—',
      op.created_by_email ?? '—',
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, wsLib, 'Liberadas esta semana')

  const wsPend = XLSX.utils.aoa_to_sheet([
    ['Interno', 'Cliente', 'Factura', 'CRT', 'Transporte', 'Fecha recep.', 'Días acumulados', 'Responsable'],
    ...pendientes.map(op => [
      op.interno ?? '—',
      op.cliente ?? '—',
      op.factura ?? '—',
      op.crt ?? '—',
      op.transporte ?? '—',
      fmtDate(op.recep_doc),
      op.recep_doc ? daysBetween(op.recep_doc, today) : '—',
      op.created_by_email ?? '—',
    ]),
  ])
  XLSX.utils.book_append_sheet(wb, wsPend, 'Pendientes')

  const excelBuf = Buffer.from(
    XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  )

  const dateStr = today.split('-').reverse().join('-') // DD-MM-YYYY
  const weekStartStr = `${sevenDaysAgo.getDate().toString().padStart(2, '0')}/${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}`

  // Upload to Google Drive
  let driveFileId: string | null = null
  const gKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

  if (gKey && folderId) {
    try {
      const creds = JSON.parse(gKey) as { client_email: string; private_key: string }
      const accessToken = await getGoogleAccessToken(creds.client_email, creds.private_key)
      driveFileId = await uploadToDrive(
        accessToken,
        folderId,
        `Reporte_RMS_${dateStr}.xlsx`,
        excelBuf
      )
    } catch (e) {
      console.error('Google Drive upload failed:', e)
    }
  }

  // Get superadmin emails
  const { data: admins } = await admin
    .from('perfiles')
    .select('email')
    .eq('rol', 'superadmin')
  const to = ((admins ?? []) as { email: string }[]).map(a => a.email).filter(Boolean)

  // Send email
  let emailSent = false
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && resendKey !== 'placeholder' && to.length > 0) {
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: 'RMS Comercio Exterior <info@rodolfoschiro.com.ar>',
      to,
      subject: `Reporte semanal RMS — Semana del ${weekStartStr}`,
      html: buildEmailHtml({
        weekStart: weekStartStr,
        liberadas: liberadasSemana.length,
        pendientes: pendientes.length,
        demoradas: demoradas.length,
        promedio,
      }),
      attachments: [
        {
          filename: `Reporte_RMS_${dateStr}.xlsx`,
          content: excelBuf,
        },
      ],
    })
    emailSent = true
  }

  return NextResponse.json({ success: true, emailSent, driveFileId })
}

// ── GET — Vercel cron ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await runReporte()
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

    return await runReporte()
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
