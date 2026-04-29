/**
 * @module LoginPage
 * @description Página de inicio de sesión con validación, rate limiting y traducción de errores al español.
 */
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { checkRateLimit, recordFailedAttempt, resetRateLimit, formatLockoutTime } from '@/utils/security'
import logoSistema from '@/assets/logo-sistema.ico'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useAuthStore()

  // Validar email
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Rate limiting
    const rateCheck = checkRateLimit('login')
    if (!rateCheck.allowed) {
      setError(`Demasiados intentos fallidos. Intenta de nuevo en ${formatLockoutTime(rateCheck.lockedUntilMs!)}`)
      return
    }

    // Validaciones del lado del cliente
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail) {
      setError('Por favor ingresa tu correo electrónico')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Por favor ingresa un correo electrónico válido')
      return
    }

    if (!trimmedPassword) {
      setError('Por favor ingresa tu contraseña')
      return
    }

    setLoading(true)

    try {
      await signIn(trimmedEmail, trimmedPassword, rememberMe)
      resetRateLimit('login')
    } catch (err: any) {
      recordFailedAttempt('login')
      const remaining = checkRateLimit('login')
      const msg = err.message || 'Error al iniciar sesión. Por favor intenta de nuevo'
      setError(remaining.remainingAttempts > 0 
        ? `${msg} (${remaining.remainingAttempts} intentos restantes)`
        : `Cuenta bloqueada temporalmente. Intenta en ${formatLockoutTime(remaining.lockedUntilMs!)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Panel izquierdo — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-white relative overflow-hidden border-r border-gray-100">
        {/* Geometric background pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1'%3E%3Crect x='10' y='10' width='60' height='60' rx='4'/%3E%3Crect x='20' y='20' width='40' height='40' rx='2'/%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-16">
          {/* Logo */}
          <img src={logoSistema} alt="SIGCAN" className="w-64 h-64 object-contain rounded-2xl -mb-6" />

          {/* Nombre del sistema */}
          <h1 className="text-5xl font-black tracking-tight text-gray-900 mb-2">SIGCAN</h1>

          {/* Por Agropecuaria Santacruz */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-gradient-to-r from-primary-400 to-emerald-400"></div>
            <span className="text-xs text-gray-400 uppercase tracking-[0.2em] font-medium">por</span>
            <div className="w-8 h-px bg-gradient-to-r from-emerald-400 to-primary-400"></div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-700 mb-1">Grupo</h2>
          <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent mb-6">SANTACRUZ</h2>

          <div className="w-16 h-1 bg-gradient-to-r from-primary-400 to-emerald-400 rounded-full mb-6"></div>

          <p className="text-base text-gray-500 font-light max-w-sm text-center">
            Plataforma integral de trazabilidad y gestión de canastillas
          </p>

          {/* Desarrollador */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Creado por</p>
            <p className="text-sm font-semibold text-gray-600 mt-1">Oscar David Hernández Guzmán</p>
            <p className="text-xs text-gray-400 mt-0.5">Departamento de Tecnología</p>
          </div>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Móvil: branding compacto */}
          <div className="lg:hidden text-center mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-lg inline-block mb-4">
              <img src={logoSistema} alt="SIGCAN" className="h-24 w-auto" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">SIGCAN</h2>
            <p className="text-xs text-gray-400 mt-1">por Grupo Santacruz</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido</h2>
              <p className="text-gray-600">Ingresa tus credenciales para continuar</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Correo Electrónico"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-gray-600">Recordarme</span>
                </label>
                <a href="/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <Button type="submit" className="w-full" loading={loading} disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                ¿Necesitas ayuda?{' '}
                <a 
                  href="https://wa.me/573117580698?text=Hola,%20necesito%20ayuda%20con%20el%20sistema%20Santacruz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Contactar soporte
                </a>
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">Versión 1.0.0 · © 2026 Agropecuaria Santacruz</p>
        </div>
      </div>
    </div>
  )
}