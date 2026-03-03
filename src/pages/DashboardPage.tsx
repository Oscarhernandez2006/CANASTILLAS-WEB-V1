import { DashboardLayout } from '@/components/DashboardLayout'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { PieChart } from '@/components/charts/PieChart'
import { BarChart } from '@/components/charts/BarChart'
import { LineChart } from '@/components/charts/LineChart'
import { LocationMap } from '@/components/LocationMap'

export function DashboardPage() {
  const stats = useDashboardStats()

  // Calcular porcentajes
  const disponiblesPercent = stats.totalCanastillas > 0
    ? Math.round((stats.disponibles / stats.totalCanastillas) * 100)
    : 0

  const alquilerInternoPercent = stats.totalCanastillas > 0
    ? Math.round((stats.enAlquilerInterno / stats.totalCanastillas) * 100)
    : 0

  const alquilerExternoPercent = stats.totalCanastillas > 0
    ? Math.round((stats.enAlquilerExterno / stats.totalCanastillas) * 100)
    : 0

  const lavadoPercent = stats.totalCanastillas > 0
    ? Math.round((stats.enLavado / stats.totalCanastillas) * 100)
    : 0

  // Datos para gráfica de pie (distribución)
  const pieData = [
    { name: 'Disponibles', value: stats.disponibles, color: '#22c55e' },
    { name: 'Alquiler Interno', value: stats.enAlquilerInterno, color: '#a855f7' },
    { name: 'Alquiler Externo', value: stats.enAlquilerExterno, color: '#ec4899' },
    { name: 'En Lavado', value: stats.enLavado, color: '#06b6d4' },
    { name: 'En Uso Interno', value: stats.enUsoInterno, color: '#3b82f6' },
    { name: 'En Reparación', value: stats.enReparacion, color: '#f97316' },
  ].filter(item => item.value > 0)

  // Datos para gráfica de barras
  const barData = [
    { name: 'Disponibles', value: stats.disponibles },
    { name: 'Alq. Interno', value: stats.enAlquilerInterno },
    { name: 'Alq. Externo', value: stats.enAlquilerExterno },
    { name: 'Lavado', value: stats.enLavado },
    { name: 'Uso Interno', value: stats.enUsoInterno },
    { name: 'Reparación', value: stats.enReparacion },
  ]

  // Datos simulados para tendencia (últimos 7 días)
  const trendData = [
    { name: 'Lun', value: stats.disponibles - 15 },
    { name: 'Mar', value: stats.disponibles - 10 },
    { name: 'Mié', value: stats.disponibles - 5 },
    { name: 'Jue', value: stats.disponibles - 8 },
    { name: 'Vie', value: stats.disponibles - 3 },
    { name: 'Sáb', value: stats.disponibles - 1 },
    { name: 'Hoy', value: stats.disponibles },
  ]

  if (stats.loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Resumen general del sistema">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout 
      title="Dashboard" 
      subtitle="Resumen general del sistema"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-end items-center">
          <p className="text-sm text-gray-500">
            Última actualización: {new Date().toLocaleString('es-CO')}
          </p>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
          {/* Card 1 - Total Canastillas */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Total</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stats.totalCanastillas}</p>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2 hidden sm:block">Inventario total</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2 - Disponibles */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Disponibles</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 mt-1 sm:mt-2">{stats.disponibles}</p>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2">{disponiblesPercent}%</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 3 - Alquiler Interno */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Alq. Interno</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600 mt-1 sm:mt-2">{stats.enAlquilerInterno}</p>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2">{alquilerInternoPercent}%</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 4 - Alquiler Externo */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">Alq. Externo</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-pink-600 mt-1 sm:mt-2">{stats.enAlquilerExterno}</p>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2">{alquilerExternoPercent}%</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 5 - En Lavado */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">En Lavado</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-600 mt-1 sm:mt-2">{stats.enLavado}</p>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2">{lavadoPercent}%</p>
              </div>
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0 ml-2">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfica de Pie - Distribución */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribución de Canastillas</h2>
            <PieChart data={pieData} />
          </div>

          {/* Mapa de ubicaciones */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Ubicaciones con Más Canastillas</h2>
            <LocationMap locations={stats.locations} />
          </div>
        </div>

        {/* Gráfica de Barras */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Canastillas por Estado</h2>
          <BarChart data={barData} color="#22c55e" />
        </div>

        {/* Gráfica de línea - Tendencia */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Disponibilidad (Última Semana)</h2>
          <LineChart data={trendData} color="#14b8a6" />
        </div>
      </div>
    </DashboardLayout>
  )
}