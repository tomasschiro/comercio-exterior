import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(d: string | null): string {
  if (!d) return '—'
  const [year, month, day] = d.split('-')
  return `${day}/${month}/${year}`
}

function buildEmailHtml(op: {
  liberacion: string | null
  factura: string | null
  crt: string | null
  despacho: string | null
}): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #E5E7EB;">
        <span style="font-size:12px;color:#6B7280;display:block;margin-bottom:2px;">${label}</span>
        <span style="font-size:14px;font-weight:600;color:#111827;">${value}</span>
      </td>
    </tr>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
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
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Estimados,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Informamos que la mercadería del siguiente despacho ha sido liberada:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:6px;border:1px solid #E5E7EB;margin-bottom:24px;">
              ${row('Fecha de liberación', formatDateLong(op.liberacion))}
              ${row('Factura', op.factura ?? '—')}
              ${row('CRT', op.crt ?? '—')}
              <tr>
                <td style="padding:12px 16px;">
                  <span style="font-size:12px;color:#6B7280;display:block;margin-bottom:2px;">N° de Despacho</span>
                  <span style="font-size:14px;font-weight:600;color:#111827;">${op.despacho ?? '—'}</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">
              La gestión aduanera por parte de RMS ha concluido.
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
              Ante cualquier consulta, comunicarse a
              <a href="mailto:rmsimpo@rodolfoschiro.com.ar" style="color:#1D4ED8;">rmsimpo@rodolfoschiro.com.ar</a>
              /
              <a href="mailto:rmsexpo@rodolfoschiro.com.ar" style="color:#1D4ED8;">rmsexpo@rodolfoschiro.com.ar</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;font-style:italic;">
              Este mensaje es generado automáticamente. Por favor no responder a este correo.
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

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    // Validate session
    const anonClient = createClient(url, anonKey)
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, liberacion } = (await req.json()) as { id: number; liberacion: string | null }

    const admin = createClient(url, serviceKey)

    // Update liberacion and retrieve fields needed for the email
    const { data: op, error: updateError } = await admin
      .from('operaciones')
      .update({ liberacion })
      .eq('id', id)
      .select('cliente, factura, crt, despacho')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message, code: updateError.code }, { status: 400 })
    }

    // Look up client email by name
    let emailSent = false
    if (liberacion && op.cliente) {
      const { data: clientData } = await admin
        .from('clientes')
        .select('email')
        .ilike('nombre', op.cliente)
        .maybeSingle()

      const clientEmail = clientData?.email ?? null

      const resendKey = process.env.RESEND_API_KEY
      if (clientEmail && resendKey && resendKey !== 'placeholder') {
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: 'RMS Comercio Exterior <info@rodolfoschiro.com.ar>',
          to: [clientEmail],
          subject: `Liberación de mercadería — Factura ${op.factura ?? '—'}`,
          html: buildEmailHtml({ ...op, liberacion }),
        })
        emailSent = true
      }
    }

    return NextResponse.json({ success: true, emailSent })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
