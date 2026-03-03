import { QRCodeDisplay } from './QRCodeDisplay'
import type { Canastilla } from '@/types'
import { getStatusLabel, getStatusColor, formatDate } from '@/utils/helpers'

interface CanastillaDetailModalProps {
  isOpen: boolean
  onClose: () => void
  canastilla: Canastilla | null
}

export function CanastillaDetailModal({ isOpen, onClose, canastilla }: CanastillaDetailModalProps) {
  if (!isOpen || !canastilla) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                Detalles de Canastilla
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Información de la canastilla */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Información General</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Código:</span>
                      <span className="text-sm font-semibold text-gray-900">{canastilla.codigo}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Código QR:</span>
                      <span className="text-sm font-semibold text-gray-900">{canastilla.qr_code}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Tamaño:</span>
                      <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {canastilla.size}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Color:</span>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-5 h-5 rounded-full border-2 border-gray-300" 
                          style={{ backgroundColor: canastilla.color.toLowerCase() }}
                        ></div>
                        <span className="text-sm font-semibold text-gray-900">{canastilla.color}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Estado:</span>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(canastilla.status)}`}>
                        {getStatusLabel(canastilla.status)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Condición:</span>
                      <span className="text-sm font-semibold text-gray-900">{canastilla.condition || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Ubicación:</span>
                      <span className="text-sm font-semibold text-gray-900">{canastilla.current_location || 'Sin ubicación'}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Área:</span>
                      <span className="text-sm font-semibold text-gray-900">{canastilla.current_area || 'Sin área'}</span>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                      <span className="text-sm font-medium text-gray-600">Creada:</span>
                      <span className="text-sm text-gray-900">{formatDate(canastilla.created_at)}</span>
                    </div>

                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm font-medium text-gray-600">Actualizada:</span>
                      <span className="text-sm text-gray-900">{formatDate(canastilla.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Código QR */}
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-6">
                <QRCodeDisplay 
                  value={canastilla.codigo}
                  size={250}
                  title="Código QR de Canastilla"
                />
                
                <div className="mt-6 w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Escanea este código QR</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Para identificar rápidamente esta canastilla en el sistema
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}