import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function formatDateLong(d: string | null): string {
  if (!d) return '—'
  const [year, month, day] = d.split('-')
  return `${day}/${month}/${year}`
}

const LOGO_URL = 'https://res.cloudinary.com/djg4pcim7/image/upload/v1779466438/logo-rms_divfey.png'

function buildEmailHtml(op: {
  interno: number | null
  liberacion: string | null
  factura: string | null
  crt: string | null
  despacho: string | null
}): string {
  const bullet = (label: string, value: string) =>
    `<p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">&#8226; <strong>${label}:</strong> ${value}</p>`

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
          <td style="background:#FFFFFF;padding:28px 32px 20px;text-align:center;border-bottom:2px solid #1F1B14;">
            <img src="${LOGO_URL}" alt="RMS Comercio Exterior" width="200" style="height:auto;display:block;margin:0 auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Informamos que la carga de importación de referencia ha sido verificada y liberada, dando por concluida nuestra gestión aduanera.
            </p>
            <div style="margin-bottom:24px;">
              ${bullet('Fecha de liberación', formatDateLong(op.liberacion))}
              ${bullet('Factura', op.factura ?? '—')}
              ${bullet('CRT', op.crt ?? '—')}
              ${bullet('Despacho', op.despacho ?? '—')}
            </div>
            <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
              Para coordinar fecha y horario de arribo, favor contactar con el transporte.
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
              Ante cualquier consulta comunicarse a
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

    const { id } = (await req.json()) as { id: number }

    const admin = createClient(url, serviceKey)

    // Fetch op fields needed for the email
    const { data: op, error: fetchError } = await admin
      .from('operaciones')
      .select('interno, cliente, factura, crt, despacho, liberacion')
      .eq('id', id)
      .single()

    if (fetchError || !op) {
      return NextResponse.json({ error: fetchError?.message ?? 'Not found' }, { status: 400 })
    }

    // Look up client email by name
    let emailSent = false
    if (op.liberacion && op.cliente) {
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
          subject: `${op.interno ?? '—'} — Liberación de mercadería — Factura ${op.factura ?? '—'}`,
          html: buildEmailHtml({ interno: op.interno, liberacion: op.liberacion, factura: op.factura, crt: op.crt, despacho: op.despacho }),
        })
        emailSent = true
      }
    }

    await admin.from('operaciones').update({ mail_enviado: true }).eq('id', id)

    return NextResponse.json({ success: true, emailSent })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
