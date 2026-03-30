/**
 * @module security
 * @description Utilidades de seguridad: validación de contraseñas y rate limiting en cliente.
 */
// ============================================================
// Utilidades de seguridad — validación de contraseñas + rate limiting
// ============================================================

// --- Validación de contraseñas ---

export interface PasswordValidation {
  isValid: boolean
  errors: string[]
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una letra mayúscula')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una letra minúscula')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos un número')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Al menos un carácter especial (!@#$%...)')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++

  if (score <= 2) return { level: 1, label: 'Débil', color: 'bg-red-500' }
  if (score <= 4) return { level: 2, label: 'Media', color: 'bg-yellow-500' }
  return { level: 3, label: 'Fuerte', color: 'bg-green-500' }
}

// --- Rate Limiting (cliente) ---

interface RateLimitEntry {
  attempts: number
  firstAttempt: number
  lockedUntil: number | null
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutos
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutos de bloqueo

export function checkRateLimit(key: string = 'login'): { allowed: boolean; remainingAttempts: number; lockedUntilMs: number | null } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  // Si está bloqueado, verificar si ya pasó el tiempo
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntilMs: entry.lockedUntil - now,
    }
  }

  // Si el bloqueo expiró, resetear
  if (entry?.lockedUntil && now >= entry.lockedUntil) {
    rateLimitStore.delete(key)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntilMs: null }
  }

  // Si la ventana de tiempo expiró, resetear
  if (entry && now - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.delete(key)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntilMs: null }
  }

  const remaining = entry ? MAX_ATTEMPTS - entry.attempts : MAX_ATTEMPTS
  return { allowed: remaining > 0, remainingAttempts: Math.max(0, remaining), lockedUntilMs: null }
}

export function recordFailedAttempt(key: string = 'login'): void {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now, lockedUntil: null })
    return
  }

  entry.attempts++

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS
  }

  rateLimitStore.set(key, entry)
}

export function resetRateLimit(key: string = 'login'): void {
  rateLimitStore.delete(key)
}

export function formatLockoutTime(ms: number): string {
  const minutes = Math.ceil(ms / 60000)
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
}
