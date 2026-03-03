import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/utils/helpers'
import { useNavigate } from 'react-router-dom'

export function WidgetCanastillasAlquiler() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    canastillasEnAlquiler: 0,
    clientesActivos: 0,
    ingresosEstimados: 0,
  })

  useEffect(() => {
    fetchStats()
  }, [user])

  const fetchStats = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Obtener alquileres activos del usuario
      const { data: rentals, error } = await supabase
        .from('rentals')
        .select(`
          id,
          start_date,
          daily_rate,
          rental_items(id)
        `)
        .eq('status', 'ACTIVO')
        .eq('created_by', user.id)

      if (error) throw error

      // Calcular estadísticas
      const clientesActivos = rentals?.length || 0
      const canastillasEnAlquiler = rentals?.reduce((sum, rental) => {
        return sum + (rental.rental_items?.length || 0)
      }, 0) || 0

      // Calcular ingresos estimados (por días transcurridos)
      const ingresosEstimados = rentals?.reduce((sum, rental) => {
        const diasTranscurridos = Math.ceil(
          (new Date().getTime() - new Date(rental.start_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        const canastillas = rental.rental_items?.length || 0
        return sum + (canastillas * rental.daily_rate * diasTranscurridos)
      }, 0) || 0

      setStats({
        canastillasEnAlquiler,
        clientesActivos,
        ingresosEstimados,
      })
    } catch (error) {
      console.error('Error fetching alquiler stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (stats.canastillasEnAlquiler === 0) {
    return null // No mostrar el widget si no hay canastillas en alquiler
  }

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg border border-blue-400 p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Canastillas en Alquiler</h3>
          <p className="text-blue-100 text-sm">Estado actual de tus alquileres</p>
        </div>
        <div className="text-3xl">📦</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <p className="text-blue-100 text-xs mb-1">Canastillas</p>
          <p className="text-2xl font-bold">{stats.canastillasEnAlquiler}</p>
        </div>

        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <p className="text-blue-100 text-xs mb-1">Clientes</p>
          <p className="text-2xl font-bold">{stats.clientesActivos}</p>
        </div>

        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <p className="text-blue-100 text-xs mb-1">Ingresos Est.</p>
          <p className="text-lg font-bold">{formatCurrency(stats.ingresosEstimados)}</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/alquileres?tab=por-cliente')}
        className="w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
      >
        <span>Ver Detalles por Cliente</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}