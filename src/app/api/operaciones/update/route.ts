import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, updates } = body

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !url) {
      return NextResponse.json({ error: 'Missing env vars', serviceKey: !!serviceKey, url: !!url }, { status: 500 })
    }

    const admin = createClient(url, serviceKey)
    const { data, error } = await admin.from('operaciones').update(updates).eq('id', id).select()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
