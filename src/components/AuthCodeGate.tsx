/**
 * @module AuthCodeGate
 * @description Componente reutilizable que solicita un código de autorización antes de permitir
 * una acción. Valida contra la tabla `pickup_auth_codes` de Supabase.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthCodeGateProps {
  /** Si true, muestra la pantalla de autorización */
  isOpen: boolean
  /** Callback cuando el código es validado exitosamente */
  onAuthorized: () => void
  /** Callback para cancelar / cerrar */
  onCancel: () => void
  /** Texto descriptivo de la acción que se va a autorizar */
  actionDescription?: string
  /** Si la acción está en curso después de autorizar */
  loading?: boolean
}

export function AuthCodeGate({ isOpen, onAuthorized, onCancel, actionDescription, loading }: AuthCodeGateProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [validating, setValidating] = useState(false)

  const handleSubmit = async () => {
    if (!code.trim()) { setError('Ingresa el código de autorización'); return }
    setValidating(true)
    setError('')
    try {
      const { data, error: dbErr } = await supabase
        .from('pickup_auth_codes')
        .select('id')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle()
      if (dbErr) throw dbErr
      if (!data) { setError('Código inválido o inactivo'); setValidating(false); return }
      setCode('')
      setError('')
      onAuthorized()
    } catch (err: any) {
      setError(err.message || 'Error al validar')
    } finally {
      setValidating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!validating && !loading) { setCode(''); setError(''); onCancel() } }} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        {/* Icono */}
        <div className="text-center mb-4">
          <div className="mx-auto w-14 h-14 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Autorización Requerida</h3>
          {actionDescription && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{actionDescription}</p>
          )}
        </div>

        {/* Input */}
        <div className="mb-4">
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            placeholder="••••••••••"
            className={`w-full px-4 py-3 text-center text-lg font-mono tracking-widest border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow ${
              error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
            autoFocus
            disabled={validating || loading}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={() => { setCode(''); setError(''); onCancel() }}
            disabled={validating || loading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!code.trim() || validating || loading}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {validating || loading ? 'Validando...' : 'Autorizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
