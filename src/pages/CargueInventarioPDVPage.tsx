/**
 * @module CargueInventarioPDVPage
 * @description Cargue de inventario mensual obligatorio para usuarios PDV.
 */
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { usePdvInventory } from '@/hooks/usePdvInventory'
import type { UploadItem, PdvUpload } from '@/services/pdvInventoryService'

const MONTH_NAMES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export function CargueInventarioPDVPage() {
  const {
    loading,
    isLastDay,
    daysUntilLastDay,
    month,
    year,
    hasUploaded,
    extension,
    canUpload,
    canastillaTypes,
    currentUpload,
    uploadHistory,
    submitting,
    submitUpload,
    getReminderMessage,
  } = usePdvInventory()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)

  const reminder = getReminderMessage()

  const handleQuantityChange = (key: string, value: string) => {
    const num = parseInt(value) || 0
    setQuantities(prev => ({ ...prev, [key]: Math.max(0, num) }))
  }

  const getItems = (): UploadItem[] => {
    return canastillaTypes
      .map((ct: { size: string; color: string; total: number }) => ({
        canastilla_size: ct.size,
        canastilla_color: ct.color,
        cantidad: quantities[`${ct.size}_${ct.color}`] || 0,
      }))
      .filter((item: UploadItem) => item.cantidad > 0)
  }

  const handleSubmit = async () => {
    const items = getItems()
    if (items.length === 0) {
      alert('Debe ingresar al menos una cantidad mayor a 0')
      return
    }
    setShowConfirmation(true)
  }

  const handleConfirm = async () => {
    try {
      const items = getItems()
      const result = await submitUpload(items)
      setUploadResult(result)
      setShowConfirmation(false)
      setQuantities({})
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const totalCanastillas = Object.values(quantities).reduce((a, b) => a + (b || 0), 0)

  if (loading) {
    return (
      <DashboardLayout title="Cargue de Inventario" subtitle="Punto de Venta">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Cargue de Inventario" subtitle={`Período: ${MONTH_NAMES[month]} ${year}`}>
      <div className="space-y-6">

        {/* Recordatorio */}
        {reminder && !hasUploaded && (
          <div className={`rounded-xl p-4 border-l-4 ${
            isLastDay
              ? 'bg-red-50 border-red-500 text-red-800'
              : 'bg-amber-50 border-amber-500 text-amber-800'
          }`}>
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="font-medium">{reminder}</p>
            </div>
          </div>
        )}

        {/* Extensión activa */}
        {extension && !hasUploaded && (
          <div className="bg-orange-50 border-l-4 border-orange-500 text-orange-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Segunda oportunidad habilitada</p>
                <p className="text-sm">Se le ha otorgado una oportunidad adicional para realizar el cargue. Este cargue quedará registrado como tardío.</p>
              </div>
            </div>
          </div>
        )}

        {/* Resultado exitoso */}
        {uploadResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2">¡Cargue de Inventario Exitoso!</h3>
            <p className="text-green-700 mb-1">
              Su inventario para <strong>{MONTH_NAMES[month]} {year}</strong> ha sido registrado correctamente.
            </p>
            {uploadResult.is_late && (
              <p className="text-orange-600 text-sm mt-2">
                ⚠️ Este cargue fue registrado como tardío (segunda oportunidad).
              </p>
            )}
            <button
              onClick={() => setUploadResult(null)}
              className="mt-4 text-green-600 hover:text-green-800 underline text-sm"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Formulario de cargue */}
        {canUpload && !uploadResult && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-primary-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Registrar Inventario Actual</h2>
              <p className="text-primary-100 text-sm">Ingrese la cantidad de canastillas que tiene actualmente por cada tipo</p>
            </div>

            <div className="p-6">
              {canastillaTypes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay tipos de canastillas registrados en el sistema.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-4 pb-2 border-b border-gray-200">
                    <div className="col-span-4 text-xs font-medium text-gray-500 uppercase">Tamaño</div>
                    <div className="col-span-4 text-xs font-medium text-gray-500 uppercase">Color</div>
                    <div className="col-span-4 text-xs font-medium text-gray-500 uppercase">Cantidad</div>
                  </div>

                  {canastillaTypes.map((ct: { size: string; color: string; total: number }) => {
                    const key = `${ct.size}_${ct.color}`
                    return (
                      <div key={key} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-gray-50">
                        <div className="col-span-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            ct.size === 'GRANDE' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {ct.size}
                          </span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-sm font-medium text-gray-700">{ct.color}</span>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            min="0"
                            value={quantities[key] || ''}
                            onChange={(e) => handleQuantityChange(key, e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
                          />
                        </div>
                      </div>
                    )
                  })}

                  {/* Total */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-lg font-semibold text-gray-900">Total canastillas:</span>
                    <span className="text-2xl font-bold text-primary-600">{totalCanastillas}</span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={totalCanastillas === 0 || submitting}
                  loading={submitting}
                >
                  {submitting ? 'Cargando...' : 'Enviar Cargue de Inventario'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ya cargó este mes */}
        {hasUploaded && !uploadResult && currentUpload && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cargue de {MONTH_NAMES[month]} {year} - Completado</h3>
                <p className="text-sm text-gray-500">
                  Realizado el {new Date(currentUpload.uploaded_at).toLocaleDateString('es-CO', {
                    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              {currentUpload.is_late && (
                <span className="ml-auto px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                  Tardío
                </span>
              )}
            </div>

            {/* Resumen de lo cargado */}
            {currentUpload.items && currentUpload.items.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Resumen del cargue</h4>
                <div className="space-y-2">
                  {currentUpload.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.canastilla_size} - {item.canastilla_color}</span>
                      <span className="font-semibold text-gray-900">{item.cantidad}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">
                      {currentUpload.items.reduce((a: number, b: any) => a + b.cantidad, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No es último día y no tiene extensión */}
        {!canUpload && !hasUploaded && !isLastDay && !extension && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cargue no disponible</h3>
            <p className="text-gray-600">
              El cargue de inventario solo está habilitado el <strong>último día del mes</strong>.
            </p>
            {daysUntilLastDay > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Faltan <strong>{daysUntilLastDay}</strong> día{daysUntilLastDay > 1 ? 's' : ''} para el cargue.
              </p>
            )}
          </div>
        )}

        {/* Historial */}
        {uploadHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Historial de Cargues</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {uploadHistory.map((upload: PdvUpload) => (
                <div key={upload.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      upload.status === 'completado' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {MONTH_NAMES[upload.period_month]} {upload.period_year}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(upload.uploaded_at).toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {upload.is_late && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        Tardío
                      </span>
                    )}
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      {upload.items?.reduce((a: number, b: any) => a + b.cantidad, 0) || 0} canastillas
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowConfirmation(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Cargue de Inventario</h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Resumen del cargue:</p>
                <div className="space-y-2">
                  {getItems().map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.canastilla_size} - {item.canastilla_color}</span>
                      <span className="font-semibold">{item.cantidad}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">{totalCanastillas}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                <strong>Período:</strong> {MONTH_NAMES[month]} {year}<br />
                {!isLastDay && extension && (
                  <span className="text-orange-600">⚠️ Este cargue será registrado como tardío.</span>
                )}
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirm} loading={submitting}>
                  Confirmar Cargue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
