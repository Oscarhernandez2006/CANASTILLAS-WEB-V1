/**
 * @module ControlInventarioPDVPage
 * @description Control administrativo de cargues de inventario PDV.
 */
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { useAuthStore } from '@/store/authStore'
import {
  getCurrentPeriod,
  getLastDayOfMonth,
  getPdvUsers,
  getUploadsByPeriod,
  getRealInventoryForPdv,
  grantUploadExtension,
  getExtensionsByPeriod,
  type PdvUpload,
  type PdvExtension,
} from '@/services/pdvInventoryService'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface PdvUser {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  department: string | null
  area: string | null
  is_active: boolean
}

export function ControlInventarioPDVPage() {
  const { user: currentUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [pdvUsers, setPdvUsers] = useState<PdvUser[]>([])
  const [uploads, setUploads] = useState<PdvUpload[]>([])
  const [extensions, setExtensions] = useState<PdvExtension[]>([])

  // En los primeros 5 días del mes, mostrar el mes anterior por defecto
  // ya que los cargues se hacen el último día del mes
  const getDefaultPeriod = () => {
    const now = new Date()
    const day = now.getDate()
    const { month, year } = getCurrentPeriod()
    if (day <= 5) {
      // Mes anterior
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      return { month: prevMonth, year: prevYear }
    }
    return { month, year }
  }
  const defaultPeriod = getDefaultPeriod()

  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month)
  const [selectedYear, setSelectedYear] = useState(defaultPeriod.year)
  const [selectedPdv, setSelectedPdv] = useState<string | null>(null)
  const [realInventory, setRealInventory] = useState<{ size: string; color: string; cantidad: number }[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Modal de extensión
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [extensionPdv, setExtensionPdv] = useState<PdvUser | null>(null)
  const [extensionReason, setExtensionReason] = useState('')
  const [extensionLoading, setExtensionLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersData, uploadsData, extensionsData] = await Promise.all([
        getPdvUsers(),
        getUploadsByPeriod(selectedMonth, selectedYear),
        getExtensionsByPeriod(selectedMonth, selectedYear),
      ])
      setPdvUsers(usersData)
      setUploads(uploadsData)
      setExtensions(extensionsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear])

  const handleSelectPdv = async (userId: string) => {
    setSelectedPdv(userId === selectedPdv ? null : userId)
    if (userId !== selectedPdv) {
      setLoadingInventory(true)
      try {
        const inv = await getRealInventoryForPdv(userId)
        setRealInventory(inv)
      } catch (error) {
        console.error('Error loading real inventory:', error)
      } finally {
        setLoadingInventory(false)
      }
    }
  }

  const handleGrantExtension = async () => {
    if (!extensionPdv || !currentUser) return
    setExtensionLoading(true)
    try {
      const adminName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      await grantUploadExtension(extensionPdv.id, currentUser.id, adminName, extensionReason)
      alert(`✅ Se habilitó segunda oportunidad para ${extensionPdv.first_name} ${extensionPdv.last_name}`)
      setShowExtensionModal(false)
      setExtensionPdv(null)
      setExtensionReason('')
      await fetchData()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setExtensionLoading(false)
    }
  }

  const getUploadForUser = (userId: string) => uploads.find(u => u.user_id === userId)
  const getExtensionForUser = (userId: string) => extensions.find(e => e.pdv_user_id === userId)
  const lastDay = getLastDayOfMonth(selectedYear, selectedMonth)

  // Generar opciones de meses
  const monthOptions = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthOptions.push({ month: d.getMonth() + 1, year: d.getFullYear() })
  }

  if (loading) {
    return (
      <DashboardLayout title="Control Inventario PDV" subtitle="Gestión y control de cargues">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Control Inventario PDV" subtitle="Gestión y control de cargues de puntos de venta">
      <div className="space-y-6">

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Período</label>
              <select
                value={`${selectedMonth}-${selectedYear}`}
                onChange={(e) => {
                  const [m, y] = e.target.value.split('-')
                  setSelectedMonth(parseInt(m))
                  setSelectedYear(parseInt(y))
                  setSelectedPdv(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {monthOptions.map(opt => (
                  <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                    {MONTH_NAMES[opt.month]} {opt.year}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">Cargue realizado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600">Pendiente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-gray-600">Tardío</span>
              </div>
            </div>
          </div>

          {/* Banner informativo: mes actual sin cargues */}
          {(() => {
            const { month: curMonth, year: curYear } = getCurrentPeriod()
            const isCurrentMonth = selectedMonth === curMonth && selectedYear === curYear
            const isEarlyInMonth = new Date().getDate() <= 5
            if (isCurrentMonth && uploads.length === 0 && isEarlyInMonth) {
              const prevMonth = curMonth === 1 ? 12 : curMonth - 1
              const prevYear = curMonth === 1 ? curYear - 1 : curYear
              return (
                <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 text-blue-800 px-4 py-3 rounded-r-lg flex items-center justify-between">
                  <p className="text-sm">
                    <strong>Nota:</strong> Estás viendo {MONTH_NAMES[curMonth]} {curYear} — aún no hay cargues este mes.
                    Los cargues del mes anterior están disponibles en <strong>{MONTH_NAMES[prevMonth]} {prevYear}</strong>.
                  </p>
                  <button
                    onClick={() => { setSelectedMonth(prevMonth); setSelectedYear(prevYear); setSelectedPdv(null) }}
                    className="ml-4 px-3 py-1 text-xs font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 transition flex-shrink-0"
                  >
                    Ver {MONTH_NAMES[prevMonth]}
                  </button>
                </div>
              )
            }
            return null
          })()}

          {/* Resumen */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{pdvUsers.length}</p>
              <p className="text-xs text-gray-500">PDV Totales</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {uploads.filter(u => !u.is_late).length}
              </p>
              <p className="text-xs text-gray-500">A tiempo</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {uploads.filter(u => u.is_late).length}
              </p>
              <p className="text-xs text-gray-500">Tardíos</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-600">
                {pdvUsers.length - uploads.length}
              </p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
          </div>
        </div>

        {/* Lista de PDV */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Puntos de Venta - {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <p className="text-sm text-gray-500">Fecha límite de cargue: {lastDay}/{selectedMonth}/{selectedYear}</p>
          </div>

          {pdvUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No hay usuarios con rol PDV registrados.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pdvUsers.map((pdv) => {
                const upload = getUploadForUser(pdv.id)
                const ext = getExtensionForUser(pdv.id)
                const isExpanded = selectedPdv === pdv.id

                return (
                  <div key={pdv.id}>
                    {/* Fila principal */}
                    <div
                      className={`px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition ${
                        isExpanded ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleSelectPdv(pdv.id)}
                    >
                      {/* Indicador de estado */}
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                        upload ? (upload.is_late ? 'bg-orange-500' : 'bg-green-500') : 'bg-red-500'
                      }`}></div>

                      {/* Info del PDV */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {pdv.first_name} {pdv.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{pdv.department || 'Sin ubicación'} {pdv.area ? `• ${pdv.area}` : ''}</p>
                      </div>

                      {/* Estado */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {upload ? (
                          <>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              upload.is_late
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {upload.is_late ? 'Tardío' : 'Completado'}
                            </span>
                            {upload.no_canastillas && (
                              <span className="px-3 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                Sin canastillas
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setExtensionPdv(pdv)
                                setShowExtensionModal(true)
                              }}
                              className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 hover:bg-purple-200 transition"
                              title="Borrar cargue actual y obligar nuevo cargue"
                            >
                              🔄 Obligar recargue
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Pendiente
                            </span>
                            {!ext && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExtensionPdv(pdv)
                                  setShowExtensionModal(true)
                                }}
                                className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                              >
                                Habilitar 2da oportunidad
                              </button>
                            )}
                            {ext && (
                              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                {ext.is_used ? '2da usada' : '2da habilitada'}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Flecha */}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Detalle expandido */}
                    {isExpanded && (
                      <div className="px-6 pb-6 bg-blue-50 border-t border-blue-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">

                          {/* Inventario reportado */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Inventario Reportado
                            </h4>
                            {upload && upload.no_canastillas ? (
                              <>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                                  <p className="text-amber-800 font-medium">📦 Sin canastillas</p>
                                  <p className="text-amber-600 text-sm mt-1">El punto de venta reportó que no tiene canastillas.</p>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                  <p><strong>Fecha:</strong> {new Date(upload.uploaded_at).toLocaleDateString('es-CO', {
                                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                  })}</p>
                                  <p><strong>Realizado por:</strong> {upload.user_name}</p>
                                  {upload.user_cedula && <p><strong>Cédula:</strong> {upload.user_cedula}</p>}
                                  {upload.is_late && <p className="text-orange-600 font-medium">⚠️ Cargue tardío (segunda oportunidad)</p>}
                                </div>
                              </>
                            ) : upload && upload.items && upload.items.length > 0 ? (
                              <>
                                <div className="space-y-2">
                                  {upload.items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <span className="text-gray-600">{item.canastilla_size} - {item.canastilla_color}</span>
                                      <span className="font-semibold">{item.cantidad}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between pt-2 border-t font-bold">
                                    <span>Total</span>
                                    <span className="text-primary-600">
                                      {upload.items.reduce((a: number, b: any) => a + b.cantidad, 0)}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                                  <p><strong>Fecha:</strong> {new Date(upload.uploaded_at).toLocaleDateString('es-CO', {
                                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                  })}</p>
                                  <p><strong>Realizado por:</strong> {upload.user_name}</p>
                                  {upload.user_cedula && <p><strong>Cédula:</strong> {upload.user_cedula}</p>}
                                  {upload.is_late && <p className="text-orange-600 font-medium">⚠️ Cargue tardío (segunda oportunidad)</p>}
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-gray-500 italic">No ha realizado el cargue para este período.</p>
                            )}
                          </div>

                          {/* Inventario real */}
                          <div className="bg-white rounded-lg p-4 shadow-sm">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Inventario Real (Sistema)
                            </h4>
                            {loadingInventory ? (
                              <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                              </div>
                            ) : realInventory.length > 0 ? (
                              <div className="space-y-2">
                                {realInventory.map((item, idx) => {
                                  const reported = upload?.items?.find(
                                    (i: any) => i.canastilla_size === item.size && i.canastilla_color === item.color
                                  )
                                  const diff = reported ? reported.cantidad - item.cantidad : null

                                  return (
                                    <div key={idx} className="flex justify-between text-sm items-center">
                                      <span className="text-gray-600">{item.size} - {item.color}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="font-semibold">{item.cantidad}</span>
                                        {diff !== null && diff !== 0 && (
                                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            diff > 0
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-red-100 text-red-800'
                                          }`}>
                                            {diff > 0 ? '+' : ''}{diff}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                <div className="flex justify-between pt-2 border-t font-bold">
                                  <span>Total</span>
                                  <span className="text-green-600">
                                    {realInventory.reduce((a, b) => a + b.cantidad, 0)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 italic">No hay canastillas asignadas a este PDV en el sistema.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal extensión */}
      {showExtensionModal && extensionPdv && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowExtensionModal(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Habilitar Segunda Oportunidad</h3>
              <p className="text-sm text-gray-600 mb-4">
                Se habilitará una nueva oportunidad de cargue para{' '}
                <strong>{extensionPdv.first_name} {extensionPdv.last_name}</strong>{' '}
                en el período <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>.
                {uploads.find(u => u.user_id === extensionPdv.id) && (
                  <span className="block mt-2 text-red-600 font-medium">
                    ⚠️ El cargue actual será eliminado y el usuario deberá subir nuevamente su inventario.
                  </span>
                )}
              </p>

              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-700 px-4 py-3 rounded-r-lg mb-4">
                <p className="text-sm">
                  <strong>Nota:</strong> El cargue realizado bajo esta oportunidad quedará registrado como tardío y se evidenciará que no se realizó en la fecha correspondiente.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Razón por la cual se habilita segunda oportunidad..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowExtensionModal(false); setExtensionPdv(null) }}>
                  Cancelar
                </Button>
                <Button onClick={handleGrantExtension} loading={extensionLoading}>
                  Habilitar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
