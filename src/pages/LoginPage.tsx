import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'

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

    if (trimmedPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      await signIn(trimmedEmail, trimmedPassword, rememberMe)
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        {/* Geometric background pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1'%3E%3Crect x='10' y='10' width='60' height='60' rx='4'/%3E%3Crect x='20' y='20' width='40' height='40' rx='2'/%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
          {/* Ambient glow effects */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-400/10 rounded-full blur-[80px]"></div>
        </div>

        {/* Diagonal accent lines */}
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden opacity-[0.06]">
          <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rotate-[35deg]"></div>
          <div className="absolute top-1/4 -right-1/4 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rotate-[35deg]"></div>
          <div className="absolute top-3/4 -left-1/4 w-[700px] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent rotate-[35deg]"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 text-white w-full">
          {/* Abstract logo mark */}
          <div className="mb-10">
            <div className="mb-8">
              <div className="w-20 h-20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-emerald-400 rounded-2xl rotate-6 opacity-80"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-emerald-500 rounded-2xl -rotate-6 opacity-60"></div>
                <div className="relative w-full h-full bg-gradient-to-br from-primary-400 to-emerald-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary-500/25">
                  <span className="text-3xl font-black text-white tracking-tighter">GS</span>
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">
              Grupo Empresarial
            </h1>
            <h1 className="text-5xl font-black mb-5 tracking-tight bg-gradient-to-r from-primary-300 via-emerald-300 to-primary-300 bg-clip-text text-transparent">
              SANTACRUZ
            </h1>
            <div className="w-16 h-1 bg-gradient-to-r from-primary-400 to-emerald-400 rounded-full mb-5"></div>
            <p className="text-lg text-gray-400 font-light max-w-sm">
              Plataforma integral de trazabilidad y gestión de canastillas
            </p>
          </div>

          {/* Stats / Features */}
          <div className="space-y-5">
            <div className="flex items-center space-x-4 group">
              <div className="w-11 h-11 bg-white/[0.07] border border-white/[0.08] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-200">Control Total</h3>
                <p className="text-xs text-gray-500">Gestión en tiempo real de inventario</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 group">
              <div className="w-11 h-11 bg-white/[0.07] border border-white/[0.08] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-200">Rápido y Eficiente</h3>
                <p className="text-xs text-gray-500">Procesos de trazabilidad optimizados</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 group">
              <div className="w-11 h-11 bg-white/[0.07] border border-white/[0.08] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-200">100% Seguro</h3>
                <p className="text-xs text-gray-500">Protección de nivel empresarial</p>
              </div>
            </div>
          </div>

          {/* Bottom branding */}
          <div className="mt-12 pt-8 border-t border-white/[0.06]">
            <p className="text-xs text-gray-600 tracking-widest uppercase">Sistema de Trazabilidad v2.0</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg dark:shadow-gray-900/50 inline-block mb-4 dark:ring-1 dark:ring-gray-700">
              <img src="/logo.png" alt="Santacruz Logo" className="h-24 w-auto" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sistema Santacruz</h2>
          </div>

          <div className="bg-white dark:bg-gray-800/80 dark:backdrop-blur-xl rounded-2xl shadow-xl dark:shadow-gray-900/50 p-8 border border-gray-100 dark:border-gray-700/50 dark:ring-1 dark:ring-gray-700/30">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Bienvenido</h2>
              <p className="text-gray-600 dark:text-gray-400">Ingresa tus credenciales para continuar</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 px-4 py-3 rounded-r-lg">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                    className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 dark:bg-gray-700"
                  />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Recordarme</span>
                </label>
                <a href="/forgot-password" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <Button type="submit" className="w-full" loading={loading} disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                ¿Necesitas ayuda?{' '}
                <a 
                  href="https://wa.me/573117580698?text=Hola,%20necesito%20ayuda%20con%20el%20sistema%20Santacruz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  Contactar soporte
                </a>
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-600 mt-8">Versión 1.0.0 · © 2026 Santacruz</p>
        </div>
      </div>
    </div>
  )
}