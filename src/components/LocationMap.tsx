import { useState } from 'react'
import type { LocationData } from '@/hooks/useDashboardStats'

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
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 min-h-[280px] border border-gray-200">
        {/* Título del mapa */}
        <div className="absolute top-2 left-2 flex items-center space-x-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span>Agropecuaria Santacruz</span>
        </div>

        {/* Grid de ubicaciones como bloques/sectores */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {locations.map((location, index) => {
            const colors = LOCATION_COLORS[index % LOCATION_COLORS.length]
            const percentage = totalCanastillas > 0 ? Math.round((location.total / totalCanastillas) * 100) : 0
            const isSelected = selectedLocation?.name === location.name

            return (
              <button
                key={location.name}
                onClick={() => setSelectedLocation(isSelected ? null : location)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                  ${isSelected
                    ? `${colors.light} ${colors.border} shadow-lg scale-105`
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
              >
                {/* Indicador de color */}
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${colors.bg}`}></div>

                {/* Icono de ubicación */}
                <div className={`w-10 h-10 rounded-lg ${colors.light} flex items-center justify-center mb-2`}>
                  <svg className={`w-5 h-5 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>

                {/* Nombre de ubicación */}
                <h4 className="font-semibold text-gray-900 text-sm truncate mb-1" title={location.name}>
                  {location.name}
                </h4>

                {/* Total de canastillas */}
                <div className="flex items-baseline space-x-1">
                  <span className={`text-2xl font-bold ${colors.text}`}>{location.total}</span>
                  <span className="text-xs text-gray-500">canastillas</span>
                </div>

                {/* Barra de porcentaje */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
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

      {/* Panel de detalles de ubicación seleccionada */}
      {selectedLocation && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{selectedLocation.name}</span>
            </h4>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Estadísticas detalladas */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-600">{selectedLocation.disponibles}</p>
              <p className="text-xs text-green-700">Disponibles</p>
            </div>
            <div className="bg-pink-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-pink-600">{selectedLocation.enAlquiler}</p>
              <p className="text-xs text-pink-700">En Alquiler</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-blue-600">{selectedLocation.enUsoInterno}</p>
              <p className="text-xs text-blue-700">Uso Interno</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-cyan-600">{selectedLocation.enLavado}</p>
              <p className="text-xs text-cyan-700">En Lavado</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-orange-600">{selectedLocation.enReparacion}</p>
              <p className="text-xs text-orange-700">Reparación</p>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 justify-center pt-2">
        {locations.map((location, index) => {
          const colors = LOCATION_COLORS[index % LOCATION_COLORS.length]
          return (
            <div key={location.name} className="flex items-center space-x-1.5 text-xs text-gray-600">
              <div className={`w-2.5 h-2.5 rounded-full ${colors.bg}`}></div>
              <span className="truncate max-w-[100px]" title={location.name}>{location.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
