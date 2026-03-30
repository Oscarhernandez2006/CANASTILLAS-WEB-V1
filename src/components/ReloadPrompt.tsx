/** @module ReloadPrompt @description Prompt de actualización de la PWA cuando hay nueva versión disponible. */
import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        // Verificar actualizaciones cada hora
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
      console.log(`SW registrado: ${swUrl}`)
    },
    onRegisterError(error) {
      console.error('Error al registrar SW:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Nueva versión disponible
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Actualiza para obtener las últimas mejoras
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Actualizar
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            Después
          </button>
        </div>
      </div>
    </div>
  )
}
