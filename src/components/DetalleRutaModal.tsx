import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouteTrackingViewer } from '@/hooks/useRoutes'
import type { DeliveryRoute } from '@/types'

function createStopIcon(order: number, status: string) {
  const colors: Record<string, string> = {
    PENDIENTE: '#9CA3AF',
    EN_CAMINO: '#3B82F6',
    LLEGADO: '#F59E0B',
    COMPLETADA: '#10B981',
    OMITIDA: '#EF4444',
  }
  const color = colors[status] || '#9CA3AF'
  return L.divIcon({
    className: 'custom-stop-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:11px;">${status === 'COMPLETADA' ? '✓' : order}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  EN_CURSO: { label: 'En Curso', color: 'bg-blue-100 text-blue-800' },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
}

const STOP_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'text-gray-500' },
  EN_CAMINO: { label: 'En Camino', color: 'text-blue-600' },
  LLEGADO: { label: 'Llegó', color: 'text-yellow-600' },
  COMPLETADA: { label: 'Completada', color: 'text-green-600' },
  OMITIDA: { label: 'Omitida', color: 'text-red-500' },
}

interface Props {
  route: DeliveryRoute
  drivers: { id: string; name: string }[]
  canAssign: boolean
  onClose: () => void
  onAssignDriver: (routeId: string, driverId: string, driverName: string) => Promise<void>
  onUpdateStatus: (routeId: string, status: string) => Promise<void>
}

export function DetalleRutaModal({ route, drivers, canAssign, onClose, onAssignDriver, onUpdateStatus }: Props) {
  const { points } = useRouteTrackingViewer(route.status === 'EN_CURSO' ? route.id : null)
  const [assignDriverId, setAssignDriverId] = useState(route.driver_id || '')
  const [assigning, setAssigning] = useState(false)
  const [tab, setTab] = useState<'info' | 'mapa'>('info')

  const stopsWithCoords = route.stops?.filter(s => s.latitude && s.longitude) || []
  const trackingLine: [number, number][] = points.map(p => [p.latitude, p.longitude])
  const routeLine: [number, number][] = stopsWithCoords.map(s => [s.latitude!, s.longitude!])

  const mapCenter: [number, number] = stopsWithCoords.length > 0
    ? [stopsWithCoords[0].latitude!, stopsWithCoords[0].longitude!]
    : [4.711, -74.0721]

  const completedStops = route.stops?.filter(s => s.status === 'COMPLETADA').length || 0
  const totalStops = route.stops?.length || 0
  const totalCanastillas = route.stops?.reduce((s, st) => s + (st.canastillas_qty || 0), 0) || 0
  const statusConfig = STATUS_LABELS[route.status] || STATUS_LABELS.PENDIENTE

  const handleAssign = async () => {
    if (!assignDriverId) return
    const driver = drivers.find(d => d.id === assignDriverId)
    if (!driver) return
    setAssigning(true)
    try {
      await onAssignDriver(route.id, driver.id, driver.name)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{route.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            {route.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{route.description}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
          <button
            onClick={() => setTab('info')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'info' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Información
          </button>
          <button
            onClick={() => setTab('mapa')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'mapa' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Mapa {route.status === 'EN_CURSO' && '🔴'}
          </button>
        </div>

        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {tab === 'info' ? (
            <div className="space-y-5">
              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totalStops}</p>
                  <p className="text-xs text-gray-500">Paradas</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{completedStops}</p>
                  <p className="text-xs text-gray-500">Completadas</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totalCanastillas}</p>
                  <p className="text-xs text-gray-500">Canastillas</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{route.driver_name || '—'}</p>
                  <p className="text-xs text-gray-500">Conductor</p>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Fecha programada</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(route.scheduled_date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Creada por</p>
                  <p className="font-medium text-gray-900 dark:text-white">{route.created_by_name || '—'}</p>
                </div>
                {route.started_at && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Inició</p>
                    <p className="font-medium text-gray-900 dark:text-white">{new Date(route.started_at).toLocaleString('es-CO')}</p>
                  </div>
                )}
                {route.completed_at && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Completó</p>
                    <p className="font-medium text-gray-900 dark:text-white">{new Date(route.completed_at).toLocaleString('es-CO')}</p>
                  </div>
                )}
              </div>
              {route.notes && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">{route.notes}</p>
                </div>
              )}

              {/* Asignar conductor */}
              {canAssign && route.status === 'PENDIENTE' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Asignar conductor</p>
                  <div className="flex gap-2">
                    <select
                      value={assignDriverId}
                      onChange={(e) => setAssignDriverId(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Seleccionar conductor</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={!assignDriverId || assigning}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {assigning ? '...' : 'Asignar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Paradas */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Paradas</h3>
                <div className="space-y-2">
                  {route.stops?.map((stop) => {
                    const stopStatus = STOP_STATUS_LABELS[stop.status] || STOP_STATUS_LABELS.PENDIENTE
                    return (
                      <div key={stop.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shrink-0 ${
                          stop.status === 'COMPLETADA' ? 'bg-green-500' : stop.status === 'OMITIDA' ? 'bg-red-400' : 'bg-gray-400'
                        }`}>
                          {stop.status === 'COMPLETADA' ? '✓' : stop.status === 'OMITIDA' ? '✕' : stop.stop_order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{stop.client_name}</p>
                            <span className={`text-xs font-medium ${stopStatus.color}`}>{stopStatus.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{stop.address}</p>
                          <div className="flex gap-2 text-xs text-gray-400 mt-0.5">
                            <span>{stop.type === 'ENTREGA' ? '📦' : '🔄'} {stop.canastillas_qty} uds.</span>
                            {stop.phone && <span>📞 {stop.phone}</span>}
                          </div>
                          {stop.driver_notes && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">💬 {stop.driver_notes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Mapa */
            <div className="rounded-xl overflow-hidden" style={{ height: '400px' }}>
              {stopsWithCoords.length > 0 ? (
                <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Ruta planificada */}
                  {routeLine.length >= 2 && (
                    <Polyline positions={routeLine} color="#94A3B8" weight={3} opacity={0.5} dashArray="6, 10" />
                  )}
                  {/* Recorrido real del conductor */}
                  {trackingLine.length >= 2 && (
                    <Polyline positions={trackingLine} color="#3B82F6" weight={4} opacity={0.8} />
                  )}
                  {/* Paradas */}
                  {stopsWithCoords.map(stop => (
                    <Marker key={stop.id} position={[stop.latitude!, stop.longitude!]} icon={createStopIcon(stop.stop_order, stop.status)}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{stop.stop_order}. {stop.client_name}</p>
                          <p className="text-gray-500">{stop.address}</p>
                          <p>{stop.canastillas_qty} canastillas</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {/* Última posición tracking */}
                  {trackingLine.length > 0 && (
                    <Marker
                      position={trackingLine[trackingLine.length - 1]}
                      icon={L.divIcon({
                        className: 'driver-live',
                        html: `<div style="background:#3B82F6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(59,130,246,0.6);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })}
                    >
                      <Popup>🚚 Posición actual del conductor</Popup>
                    </Marker>
                  )}
                </MapContainer>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400">Sin coordenadas disponibles</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Las paradas no tienen ubicación geográfica</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 dark:border-gray-800">
          <div>
            {route.status === 'PENDIENTE' && (
              <button
                onClick={() => onUpdateStatus(route.id, 'CANCELADA')}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100"
              >
                Cancelar Ruta
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
