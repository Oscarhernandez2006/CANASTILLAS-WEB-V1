import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/index'

// Traducir errores de Supabase a español
const translateAuthError = (error: any): string => {
  const message = error?.message || error?.code || ''
  const code = error?.code || ''

  // Errores de autenticación
  if (message.includes('Invalid login credentials') || code === 'invalid_credentials') {
    return 'Correo electrónico o contraseña incorrectos'
  }
  if (message.includes('Email not confirmed')) {
    return 'Por favor confirma tu correo electrónico antes de iniciar sesión'
  }
  if (message.includes('Invalid email')) {
    return 'El correo electrónico no es válido'
  }
  if (message.includes('User not found')) {
    return 'No existe una cuenta con este correo electrónico'
  }
  if (message.includes('Too many requests') || code === 'over_request_rate_limit') {
    return 'Demasiados intentos. Por favor espera unos minutos'
  }
  if (message.includes('Network') || message.includes('fetch')) {
    return 'Error de conexión. Verifica tu internet'
  }

  // Errores de base de datos (usuarios)
  if (code === 'PGRST116' || message.includes('0 rows')) {
    return 'Tu cuenta no está configurada correctamente. Contacta al administrador'
  }
  if (message.includes('JWT expired')) {
    return 'Tu sesión ha expirado. Por favor inicia sesión nuevamente'
  }

  // Error genérico
  return 'Error al iniciar sesión. Por favor intenta de nuevo'
}

interface AuthState {
  user: User | null
  session: any
  loading: boolean
  setUser: (user: User | null) => void
  setSession: (session: any) => void
  setLoading: (loading: boolean) => void
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),

  signIn: async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(translateAuthError(error))
      }

      if (data.user) {
        // Obtener información adicional del usuario desde la tabla users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (userError) {
          console.error('Error fetching user data:', userError)
          throw new Error(translateAuthError(userError))
        }

        // Verificar si el usuario está activo
        if (!userData.is_active) {
          throw new Error('Tu cuenta está desactivada. Contacta al administrador')
        }

        // Guardar preferencia de "Recordarme"
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true')
        } else {
          localStorage.removeItem('rememberMe')
          // Usar sessionStorage para indicar sesión temporal
          sessionStorage.setItem('tempSession', 'true')
        }

        set({ user: userData, session: data.session })
      }
    } catch (error: any) {
      console.error('Error signing in:', error)
      // Si ya es un Error con mensaje traducido, pasarlo directamente
      if (error.message && !error.code) {
        throw error
      }
      throw new Error(translateAuthError(error))
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      // Limpiar flags de sesión
      localStorage.removeItem('rememberMe')
      sessionStorage.removeItem('tempSession')
      set({ user: null, session: null })
    } catch (error: any) {
      console.error('Error signing out:', error)
      throw error
    }
  },

  initialize: async () => {
    try {
      set({ loading: true })

      // Verificar si es una sesión temporal que ya expiró (cerró el navegador)
      const rememberMe = localStorage.getItem('rememberMe')
      const tempSession = sessionStorage.getItem('tempSession')

      // Si no tiene "Recordarme" y no hay sesión temporal, cerrar sesión
      if (!rememberMe && !tempSession) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Había sesión pero el usuario no marcó "Recordarme" y cerró el navegador
          await supabase.auth.signOut()
          set({ user: null, session: null, loading: false })
          return
        }
      }

      // Obtener sesión actual
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        // Obtener datos del usuario
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (error) throw error

        set({ user: userData, session })
      }
    } catch (error) {
      console.error('Error initializing auth:', error)
    } finally {
      set({ loading: false })
    }
  },
}))