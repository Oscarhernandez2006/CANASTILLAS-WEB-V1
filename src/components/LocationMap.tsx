/** @module LocationMap @description Mapa visual de canastillas por usuario con modal de estadísticas. */
import { useState } from 'react'
import type { LocationData } from '@/hooks/useDashboardStats'
import { UserStatsModal } from '@/components/UserStatsModal'

interface LocationMapProps {
  locations: LocationData[]
}

// Colores para cada ubicación
const LOCATION_COLORS = [
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300' },
  { bg: 'bg-red-500', light: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  { bg: 'bg-lime-500', light: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-300' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  { bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  { bg: 'bg-sky-500', light: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
  { bg: 'bg-fuchsia-500', light: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-300' },
]

export function LocationMap({ locations }: LocationMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No hay ubicaciones registradas</p>
        <p className="text-xs mt-1">Las ubicaciones aparecerán aquí cuando asignes canastillas</p>
      </div>
    )
  }

  // Calcular el total para porcentajes
  const totalCanastillas = locations.reduce((sum, loc) => sum + loc.total, 0)

  return (
    <div className="space-y-4">
      {/* Mapa esquemático visual */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 min-h-[280px] border border-gray-200 dark:border-gray-700">
        {/* Título del mapa */}
        <div className="absolute top-2 left-2 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Canastillas por Usuario</span>
        </div>

        {/* Grid de ubicaciones como bloques/sectores */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {locations.map((location, index) => {
            const colors = LOCATION_COLORS[index % LOCATION_COLORS.length]
            const percentage = totalCanastillas > 0 ? Math.round((location.total / totalCanastillas) * 100) : 0

            return (
              <button
                key={location.name}
                onClick={() => setSelectedLocation(location)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                  bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md`}
              >
                {/* Indicador de color */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${colors.bg}`}></div>

                {/* Icono de usuario */}
                <div className={`w-10 h-10 rounded-lg ${colors.light} flex items-center justify-center mb-2`}>
                  <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>

                {/* Nombre del usuario */}
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate mb-0.5" title={location.name}>
                  {location.name}
                </h4>

                {/* Ubicación y Área */}
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={location.userId.startsWith('client_') ? location.area : `${location.ubicacion} - ${location.area}`}>
                  {location.userId.startsWith('client_') ? location.area : `${location.ubicacion} · ${location.area}`}
                </p>

                {/* Total de canastillas */}
                <div className="flex items-baseline space-x-1">
                  <span className={`text-2xl font-bold ${colors.text}`}>{location.total}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">canastillas</span>
                </div>

                {/* Barra de porcentaje */}
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${colors.bg} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400 mt-1">{percentage}%</span>
              </button>
            )
          })}
        </div>

        {/* Líneas decorativas de conexión */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />
        </svg>
      </div>

      {/* Modal de estadísticas del usuario */}
      {selectedLocation && (
        <UserStatsModal
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}

    </div>
  )
}
