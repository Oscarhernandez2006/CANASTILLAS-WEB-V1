import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useUserLocations, useGeolocationSender, type UserLocation } from '@/hooks/useGeolocation'

// Fix para íconos de Leaflet en builds con Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const ROLE_COLORS: Record<string, string> = {
  conductor: '#EF4444',
  operator: '#3B82F6',
  supervisor: '#8B5CF6',
  admin: '#F59E0B',
  super_admin: '#10B981',
  logistics: '#F97316',
  washing_staff: '#06B6D4',
  client: '#6B7280',
  pdv: '#EC4899',
  sale_point: '#EC4899',
}

const ROLE_LABELS: Record<string, string> = {
  conductor: 'Conductor',
  operator: 'Operador',
  supervisor: 'Supervisor',
  admin: 'Admin',
  super_admin: 'Super Admin',
  logistics: 'Logística',
  washing_staff: 'Lavado',
  client: 'Cliente',
  pdv: 'PDV',
  sale_point: 'Punto de Venta',
}

function createColoredIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        position: relative;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function FlyToUser({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.flyTo([lat, lng], 15, { duration: 1.5 })
  return null
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  return `Hace ${Math.floor(hours / 24)}d`
}

export function GeolocalizacionPage() {
  const { locations, loading } = useUserLocations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [filterRole, setFilterRole] = useState<string>('todos')
  const [trackingEnabled, setTrackingEnabled] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  // Actualizar el timestamp cada 30 segundos para recalcular "hace X min"
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Enviar ubicación del usuario actual
  useGeolocationSender(trackingEnabled)

  // Colombia: centro aproximado
  const defaultCenter: [number, number] = [4.6097, -74.0817]

  const filteredLocations = useMemo(() => {
    return locations.filter((loc: UserLocation) => {
      const matchesSearch = searchQuery === '' ||
        loc.user?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.user?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.user?.department?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesRole = filterRole === 'todos' || loc.user?.role === filterRole

      return matchesSearch && matchesRole
    })
  }, [locations, searchQuery, filterRole])

  const selectedLocation = selectedUserId
    ? filteredLocations.find((l: UserLocation) => l.user_id === selectedUserId)
    : null

  const onlineCount = locations.filter((l: UserLocation) => {
    const diff = now - new Date(l.updated_at).getTime()
    return diff < 5 * 60 * 1000 // 5 minutos
  }).length

  return (
    <DashboardLayout title="Geolocalización" subtitle="Rastreo en tiempo real de usuarios y canastillas">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)]">
        {/* Panel lateral */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
          {/* Stats rápidos */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Estado</h3>
              <button
                onClick={() => setTrackingEnabled(!trackingEnabled)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  trackingEnabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${trackingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {trackingEnabled ? 'Mi GPS activo' : 'GPS inactivo'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-primary-600">{onlineCount}</p>
                <p className="text-xs text-gray-500">En línea</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-gray-600">{locations.length}</p>
                <p className="text-xs text-gray-500">Con ubicación</p>
              </div>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="todos">Todos los roles</option>
              <option value="conductor">Conductores</option>
              <option value="operator">Operadores</option>
              <option value="supervisor">Supervisores</option>
              <option value="logistics">Logística</option>
              <option value="washing_staff">Lavado</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Lista de usuarios */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500">No hay usuarios con ubicación</p>
              </div>
            ) : (
              filteredLocations.map((loc: UserLocation) => {
                const isOnline = now - new Date(loc.updated_at).getTime() < 5 * 60 * 1000
                const isSelected = selectedUserId === loc.user_id
                const roleColor = ROLE_COLORS[loc.user?.role || ''] || '#6B7280'

                return (
                  <button
                    key={loc.user_id}
                    onClick={() => setSelectedUserId(isSelected ? null : loc.user_id)}
                    className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: roleColor }}
                        >
                          {loc.user?.first_name?.charAt(0) || '?'}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                          isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {loc.user?.first_name} {loc.user?.last_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                            style={{ backgroundColor: roleColor }}
                          >
                            {ROLE_LABELS[loc.user?.role || ''] || loc.user?.role}
                          </span>
                          {loc.user?.department && (
                            <span className="text-xs text-gray-500 truncate">{loc.user.department}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-400">{getTimeSince(loc.updated_at)}</span>
                          {(loc.canastillas_count ?? 0) > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                              {loc.canastillas_count} canast.
                            </span>
                          )}
                        </div>
                        {loc.speed != null && loc.speed > 0 && (
                          <span className="text-xs text-orange-500 font-medium">
                            🚗 {Math.round(loc.speed * 3.6)} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 rounded-xl overflow-hidden shadow-lg relative" style={{ minHeight: '400px' }}>
          <MapContainer
            center={defaultCenter}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {selectedLocation && (
              <FlyToUser lat={selectedLocation.latitude} lng={selectedLocation.longitude} />
            )}

            {filteredLocations.map((loc: UserLocation) => {
              const roleColor = ROLE_COLORS[loc.user?.role || ''] || '#6B7280'
              const isOnline = now - new Date(loc.updated_at).getTime() < 5 * 60 * 1000

              return (
                <Marker
                  key={loc.user_id}
                  position={[loc.latitude, loc.longitude]}
                  icon={createColoredIcon(isOnline ? roleColor : '#9CA3AF')}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: roleColor }}
                        >
                          {loc.user?.first_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{loc.user?.first_name} {loc.user?.last_name}</p>
                          <p className="text-xs text-gray-500">{ROLE_LABELS[loc.user?.role || ''] || loc.user?.role}</p>
                        </div>
                      </div>
                      {loc.user?.department && (
                        <p className="text-xs text-gray-600 mb-1">📍 {loc.user.department}</p>
                      )}
                      {loc.user?.phone && (
                        <p className="text-xs text-gray-600 mb-1">📞 {loc.user.phone}</p>
                      )}
                      <p className="text-xs text-gray-600 mb-1">
                        📦 Canastillas: <strong>{loc.canastillas_count || 0}</strong>
                      </p>
                      {loc.speed != null && loc.speed > 0 && (
                        <p className="text-xs text-gray-600 mb-1">
                          🚗 Velocidad: <strong>{Math.round(loc.speed * 3.6)} km/h</strong>
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {isOnline ? '🟢' : '⚪'} {getTimeSince(loc.updated_at)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          {/* Leyenda */}
          <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1000]">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Roles</p>
            <div className="space-y-1">
              {Object.entries(ROLE_LABELS).slice(0, 5).map(([role, label]) => (
                <div key={role} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ROLE_COLORS[role] }}></span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
