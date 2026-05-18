'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'register'

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 14,
  border: '0.5px solid #E8E5DE',
  borderRadius: 6,
  outline: 'none',
  color: '#0D0D0D',
  background: '#FFFFFF',
  transition: 'border-color 100ms, box-shadow 100ms',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#6B6860',
  marginBottom: 4,
}

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#18181B'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#E8E5DE'
  e.currentTarget.style.boxShadow = 'none'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
    setInfo('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    const res = await fetch('/api/check-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: authData.session?.access_token }),
    })
    const perfil = await res.json()

    if (!perfil?.aprobado) {
      await supabase.auth.signOut()
      setError('Tu cuenta está pendiente de aprobación.')
      setLoading(false)
      return
    }

    router.push('/operaciones')
    router.refresh()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setLoading(false)
    setInfo('Tu cuenta fue creada. Un administrador debe aprobarla.')
    setNombre('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, background: '#0D0D0D', borderRadius: 2 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0D0D0D', letterSpacing: '-0.01em' }}>
              Comercio Exterior
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#9C9A94', margin: 0 }}>Gestión de Operaciones</p>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', borderRadius: 10, border: '0.5px solid #E8E5DE', overflow: 'hidden' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', padding: '12px 16px', borderBottom: '0.5px solid #E8E5DE', gap: 4 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 100ms, color 100ms',
                  background: mode === m ? '#18181B' : 'transparent',
                  color: mode === m ? '#FFFFFF' : '#6B6860',
                }}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <div style={{ padding: 24 }}>
            {mode === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="email" style={labelStyle}>Email</label>
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="nombre@empresa.com" />
                </div>
                <div>
                  <label htmlFor="password" style={labelStyle}>Contraseña</label>
                  <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="••••••••" />
                </div>

                {error && <LoginAlert type="error">{error}</LoginAlert>}

                <button type="submit" disabled={loading}
                  style={{ height: 36, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 120ms', marginTop: 2 }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#27272A' }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#18181B' }}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="nombre" style={labelStyle}>Nombre completo</label>
                  <input id="nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    required autoComplete="name" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="Juan García" />
                </div>
                <div>
                  <label htmlFor="reg-email" style={labelStyle}>Email</label>
                  <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="nombre@empresa.com" />
                </div>
                <div>
                  <label htmlFor="reg-password" style={labelStyle}>Contraseña</label>
                  <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="new-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="••••••••" />
                </div>
                <div>
                  <label htmlFor="confirm-password" style={labelStyle}>Confirmar contraseña</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    required autoComplete="new-password" style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                    placeholder="••••••••" />
                </div>

                {error && <LoginAlert type="error">{error}</LoginAlert>}
                {info && <LoginAlert type="info">{info}</LoginAlert>}

                <button type="submit" disabled={loading}
                  style={{ height: 36, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 120ms', marginTop: 2 }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#27272A' }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#18181B' }}>
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginAlert({ type, children }: { type: 'error' | 'info'; children: React.ReactNode }) {
  const style: React.CSSProperties = type === 'error'
    ? { background: '#FEF2F2', border: '0.5px solid #FCA5A5', color: '#DC2626' }
    : { background: '#EFF6FF', border: '0.5px solid #BFDBFE', color: '#2563EB' }
  return (
    <div style={{ ...style, padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
      {children}
    </div>
  )
}
