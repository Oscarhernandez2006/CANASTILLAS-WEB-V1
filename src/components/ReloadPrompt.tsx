/** @module ReloadPrompt @description Actualización automática instantánea. Detecta nuevos deploys y recarga. */
import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL = 30 * 1000 // Verificar cada 30 segundos

export function ReloadPrompt() {
  const initialHash = useRef<string | null>(null)

  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), CHECK_INTERVAL)
      }
    },
    onRegisterError(error) {
      console.error('Error al registrar SW:', error)
    },
  })

  useEffect(() => {
    async function getPageHash() {
      try {
        const res = await fetch('/?_v=' + Date.now(), { cache: 'no-store' })
        const text = await res.text()
        const scripts = text.match(/\/assets\/[^"']+/g)
        return scripts ? scripts.sort().join('|') : ''
      } catch {
        return null
      }
    }

    getPageHash().then(hash => {
      if (hash) initialHash.current = hash
    })

    const interval = setInterval(async () => {
      const currentHash = await getPageHash()
      if (!currentHash || !initialHash.current) return

      if (currentHash !== initialHash.current) {
        console.log('Nueva versión detectada, recargando...')
        window.location.reload()
      }
    }, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  return null
}
