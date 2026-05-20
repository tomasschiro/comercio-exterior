'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'login' | 'register'

const INPUT: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  outline: 'none',
  color: 'var(--ink-1)',
  background: 'var(--surface)',
  fontFamily: 'inherit',
  transition: 'border-color 100ms, box-shadow 100ms',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--ink-3)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

function onFocusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--accent-2)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29,78,216,0.12)'
}
function onBlurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--line)'
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

    router.push('/dashboard')
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, background: 'var(--ink-1)', borderRadius: 2 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
              R.M.S Comercio Exterior
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-4)', margin: 0 }}>Gestión de Operaciones</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', padding: '10px 12px', borderBottom: '1px solid var(--line)', gap: 4 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 100ms, color 100ms',
                  background: mode === m ? 'var(--ink-1)' : 'transparent',
                  color: mode === m ? '#FFFFFF' : 'var(--ink-3)',
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
                  <label htmlFor="email" style={LABEL}>Email</label>
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="nombre@empresa.com" />
                </div>
                <div>
                  <label htmlFor="password" style={LABEL}>Contraseña</label>
                  <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="current-password" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="••••••••" />
                </div>

                {error && <Alert type="error">{error}</Alert>}

                <BtnPrimary type="submit" disabled={loading}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </BtnPrimary>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="nombre" style={LABEL}>Nombre completo</label>
                  <input id="nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    required autoComplete="name" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="Juan García" />
                </div>
                <div>
                  <label htmlFor="reg-email" style={LABEL}>Email</label>
                  <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required autoComplete="email" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="nombre@empresa.com" />
                </div>
                <div>
                  <label htmlFor="reg-password" style={LABEL}>Contraseña</label>
                  <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    required autoComplete="new-password" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="••••••••" />
                </div>
                <div>
                  <label htmlFor="confirm-password" style={LABEL}>Confirmar contraseña</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    required autoComplete="new-password" style={INPUT} onFocus={onFocusInput} onBlur={onBlurInput}
                    placeholder="••••••••" />
                </div>

                {error && <Alert type="error">{error}</Alert>}
                {info && <Alert type="info">{info}</Alert>}

                <BtnPrimary type="submit" disabled={loading}>
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </BtnPrimary>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BtnPrimary({ children, disabled, type }: { children: React.ReactNode; disabled?: boolean; type?: 'submit' | 'button' }) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      style={{
        height: 34, fontSize: 13, fontWeight: 500,
        color: '#FFFFFF',
        background: disabled ? 'var(--ink-3)' : 'var(--ink-1)',
        border: 'none',
        borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms',
        marginTop: 2,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#000' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'var(--ink-1)' }}
    >
      {children}
    </button>
  )
}

function Alert({ type, children }: { type: 'error' | 'info'; children: React.ReactNode }) {
  const style: React.CSSProperties = type === 'error'
    ? { background: 'var(--bad-bg)', border: '1px solid var(--bad)', color: 'var(--bad)' }
    : { background: 'var(--info-bg)', border: '1px solid var(--info)', color: 'var(--info)' }
  return (
    <div style={{ ...style, padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13 }}>
      {children}
    </div>
  )
}
