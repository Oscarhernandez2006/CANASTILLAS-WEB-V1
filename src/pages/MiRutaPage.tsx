import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useDriverRoutes, useRouteTracking } from '@/hooks/useRoutes'
import type { DeliveryRouteStop } from '@/types'

// Fix para íconos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STOP_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDIENTE: { label: 'Pendiente', color: '#9CA3AF', bg: 'bg-gray-100 text-gray-700' },
  EN_CAMINO: { label: 'En Camino', color: '#3B82F6', bg: 'bg-blue-100 text-blue-700' },
  LLEGADO: { label: 'Llegué', color: '#F59E0B', bg: 'bg-yellow-100 text-yellow-700' },
  COMPLETADA: { label: 'Completada', color: '#10B981', bg: 'bg-green-100 text-green-700' },
  OMITIDA: { label: 'Omitida', color: '#EF4444', bg: 'bg-red-100 text-red-700' },
}

function createStopIcon(order: number, status: string) {
  const color = STOP_STATUS_CONFIG[status]?.color || '#9CA3AF'
  const isCompleted = status === 'COMPLETADA'
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        background: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">${isCompleted ? '✓' : order}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

function createDriverIcon() {
  return L.divIcon({
    className: 'driver-marker',
    html: `
      <div style="
        background: #3B82F6;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 3px 10px rgba(59,130,246,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        animation: pulse 2s infinite;
      ">🚚</div>
      <style>
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          70% { box-shadow: 0 0 0 15px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
      </style>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 })
  }, [lat, lng, map])
  return null
}

function StopCard({ stop, isActive, onAction }: {
  stop: DeliveryRouteStop
  isActive: boolean
  onAction: (stopId: string, status: string) => void
}) {
  const config = STOP_STATUS_CONFIG[stop.status] || STOP_STATUS_CONFIG.PENDIENTE
  const [notes, setNotes] = useState('')

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      isActive
        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
        : stop.status === 'COMPLETADA'
          ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white shrink-0`}
          style={{ backgroundColor: config.color }}
        >
          {stop.status === 'COMPLETADA' ? '✓' : stop.stop_order}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{stop.client_name}</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>{config.label}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">📍 {stop.address}</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              {stop.type === 'ENTREGA' ? '📦 Entrega' : '🔄 Recolección'} — {stop.canastillas_qty} canastillas
            </span>
            {stop.phone && (
              <a href={`tel:${stop.phone}`} className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                📞 {stop.phone}
              </a>
            )}
          </div>
          {stop.notes && <p className="text-xs text-gray-400 mt-1 italic">{stop.notes}</p>}

          {/* Acciones según estado */}
          {isActive && stop.status !== 'COMPLETADA' && stop.status !== 'OMITIDA' && (
            <div className="mt-3 space-y-2">
              {stop.status === 'PENDIENTE' && (
                <button
                  onClick={() => onAction(stop.id, 'EN_CAMINO')}
                  className="w-full py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  🚚 Ir a esta parada
                </button>
              )}
              {stop.status === 'EN_CAMINO' && (
                <button
                  onClick={() => onAction(stop.id, 'LLEGADO')}
                  className="w-full py-2 px-3 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  📍 Ya llegué
                </button>
              )}
              {stop.status === 'LLEGADO' && (
                <div className="space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas de la entrega (opcional)..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAction(stop.id, 'COMPLETADA')}
                      className="flex-1 py-2 px-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      ✅ Completar
                    </button>
                    <button
                      onClick={() => onAction(stop.id, 'OMITIDA')}
                      className="py-2 px-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                    >
                      Omitir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MiRutaPage() {
  const { routes, activeRoute, loading, startRoute, completeRoute, markStopStatus } = useDriverRoutes()
  const { tracking, currentPosition, startTracking, stopTracking } = useRouteTracking(activeRoute?.id || null)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)

  // Auto-start tracking when route is en curso
  useEffect(() => {
    if (activeRoute && !tracking) {
      startTracking()
    }
  }, [activeRoute, tracking, startTracking])

  const handleStopAction = async (stopId: string, status: string) => {
    if (!navigator.geolocation) {
      await markStopStatus(stopId, status)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await markStopStatus(stopId, status, {
          driver_latitude: pos.coords.latitude,
          driver_longitude: pos.coords.longitude,
        })
      },
      async () => {
        await markStopStatus(stopId, status)
      },
      { enableHighAccuracy: true, timeout: 5000 },
    )
  }

  // Get next pending stop
  const nextStop = activeRoute?.stops?.find(
    s => s.status !== 'COMPLETADA' && s.status !== 'OMITIDA'
  )

  // Map center
  const mapCenter: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : activeRoute?.stops?.[0]?.latitude && activeRoute?.stops?.[0]?.longitude
      ? [activeRoute.stops[0].latitude, activeRoute.stops[0].longitude]
      : [4.711, -74.0721] // Bogotá por defecto

  // Stops with coords for map
  const stopsWithCoords = activeRoute?.stops?.filter(s => s.latitude && s.longitude) || []

  // Route line
  const routeLine: [number, number][] = stopsWithCoords.map(s => [s.latitude!, s.longitude!])

  const completedStops = activeRoute?.stops?.filter(s => s.status === 'COMPLETADA').length || 0
  const totalStops = activeRoute?.stops?.length || 0
  const allStopsDone = totalStops > 0 && completedStops === totalStops

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  // Si no hay ruta activa, mostrar lista de rutas pendientes
  if (!activeRoute) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi Ruta</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tus rutas de entrega asignadas</p>
          </div>

          {routes.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
              <div className="text-5xl mb-4">🚚</div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">No tienes rutas asignadas</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cuando te asignen una ruta aparecerá aquí</p>
            </div>
          ) : (
            <div className="space-y-4">
              {routes.map(route => (
                <div key={route.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{route.name}</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⏳ Pendiente
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span>📅 {new Date(route.scheduled_date + 'T00:00:00').toLocaleDateString('es-CO')}</span>
                    <span>📍 {route.stops?.length || 0} paradas</span>
                    <span>📦 {route.stops?.reduce((s, st) => s + (st.canastillas_qty || 0), 0) || 0} canastillas</span>
                  </div>
                  {route.notes && <p className="text-sm text-gray-400 mb-4 italic">{route.notes}</p>}
                  <button
                    onClick={() => startRoute(route.id)}
                    className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors text-center"
                  >
                    🚀 Iniciar Ruta
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  // Vista con ruta activa - Mapa + paradas
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header de ruta activa */}
        <div className="bg-blue-600 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">{activeRoute.name}</h1>
              <p className="text-blue-100 text-sm">{completedStops} de {totalStops} paradas completadas</p>
            </div>
            <div className="flex items-center gap-2">
              {tracking && (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-500 rounded-lg text-xs font-medium">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  GPS activo
                </span>
              )}
            </div>
          </div>
          {/* Barra de progreso */}
          <div className="mt-3 w-full h-2 bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${totalStops > 0 ? (completedStops / totalStops) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ height: '350px' }}>
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Línea de ruta */}
            {routeLine.length >= 2 && (
              <Polyline positions={routeLine} color="#3B82F6" weight={4} opacity={0.7} dashArray="8, 12" />
            )}

            {/* Paradas */}
            {stopsWithCoords.map(stop => (
              <Marker
                key={stop.id}
                position={[stop.latitude!, stop.longitude!]}
                icon={createStopIcon(stop.stop_order, stop.status)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">{stop.stop_order}. {stop.client_name}</p>
                    <p className="text-gray-500">{stop.address}</p>
                    <p>{stop.type === 'ENTREGA' ? '📦 Entrega' : '🔄 Recolección'} — {stop.canastillas_qty} uds.</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Posición del conductor */}
            {currentPosition && (
              <Marker
                position={[currentPosition.lat, currentPosition.lng]}
                icon={createDriverIcon()}
              >
                <Popup>
                  <p className="font-bold text-sm">📍 Tu posición actual</p>
                </Popup>
              </Marker>
            )}

            {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          </MapContainer>
        </div>

        {/* Botón completar ruta */}
        {allStopsDone && (
          <button
            onClick={() => { stopTracking(); completeRoute(activeRoute.id) }}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors"
          >
            🏁 Finalizar Ruta
          </button>
        )}

        {/* Lista de paradas */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Paradas</h2>
          {activeRoute.stops?.map(stop => (
            <div key={stop.id} onClick={() => {
              if (stop.latitude && stop.longitude) {
                setFlyTarget({ lat: stop.latitude, lng: stop.longitude })
              }
            }}>
              <StopCard
                stop={stop}
                isActive={nextStop?.id === stop.id}
                onAction={handleStopAction}
              />
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
