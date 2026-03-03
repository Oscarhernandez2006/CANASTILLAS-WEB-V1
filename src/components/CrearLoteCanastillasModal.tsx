import { useState } from 'react'
import { Button } from './Button'
import { DynamicSelect } from './DynamicSelect'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import type { TipoPropiedad } from '@/types'

interface CrearLoteCanastillasModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CrearLoteCanastillasModal({ isOpen, onClose, onSuccess }: CrearLoteCanastillasModalProps) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  // Cargar atributos dinámicos
  const colores = useCanastillaAttributes('COLOR')
  const tamaños = useCanastillaAttributes('SIZE')
  const formas = useCanastillaAttributes('FORMA')
  const ubicaciones = useCanastillaAttributes('UBICACION')
  const areas = useCanastillaAttributes('AREA')
  const condiciones = useCanastillaAttributes('CONDICION')

  const [formData, setFormData] = useState({
    cantidad: '1',
    size: '',
    color: '',
    shape: '',
    condition: 'Bueno',
    current_location: '',
    current_area: '',
    tipo_propiedad: 'PROPIA' as TipoPropiedad,
  })

  // Función para generar código único - incluye índice para evitar colisiones en loops rápidos
  const generarCodigoUnico = (index: number) => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)
    const indexStr = index.toString(36).padStart(4, '0')
    return `C${timestamp}${indexStr}${random}`.toUpperCase()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setProgress(0)

    try {
      // Validar campos requeridos primero
      if (!formData.size || formData.size.trim() === '') {
        throw new Error('El tamaño es requerido')
      }
      if (!formData.color || formData.color.trim() === '') {
        throw new Error('El color es requerido')
      }
      if (!formData.condition || formData.condition.trim() === '') {
        throw new Error('La condición es requerida')
      }

      // Usar el usuario del store de autenticación
      if (!user || !user.id) {
        throw new Error('No se pudo obtener el usuario. Por favor, inicia sesión nuevamente.')
      }

      const userId = user.id
      console.log('Creando canastillas para usuario:', userId)

      // Convertir cantidad a número y validar
      const cantidadNum = Math.max(1, parseInt(formData.cantidad) || 1)
      if (cantidadNum < 1 || cantidadNum > 10000) {
        throw new Error('La cantidad debe estar entre 1 y 10,000')
      }

      console.log(`Preparando ${cantidadNum} canastillas con códigos únicos...`)

      // Crear array de canastillas con códigos únicos
      const canastillas = []

      for (let i = 0; i < cantidadNum; i++) {
        const codigo = generarCodigoUnico(i)

        canastillas.push({
          codigo,
          qr_code: codigo, // Usar el mismo código único para evitar duplicados
          size: formData.size,
          color: formData.color,
          shape: formData.shape || null,
          status: 'DISPONIBLE',
          condition: formData.condition,
          current_location: formData.current_location || null,
          current_area: formData.current_area || null,
          current_owner_id: userId,
          tipo_propiedad: formData.tipo_propiedad,
        })
      }

      // Insertar en lotes de 500 para mayor velocidad
      const batchSize = 500
      let insertados = 0

      console.log(`Insertando ${canastillas.length} canastillas en lotes de ${batchSize}`)

      for (let i = 0; i < canastillas.length; i += batchSize) {
        const batch = canastillas.slice(i, i + batchSize)

        console.log(`Insertando lote ${Math.floor(i / batchSize) + 1}: ${batch.length} canastillas`)

        const { error: insertError } = await supabase
          .from('canastillas')
          .insert(batch)

        if (insertError) {
          console.error('Error insertando lote:', insertError)
          throw new Error(`Error al insertar canastillas: ${insertError.message}`)
        }

        console.log(`Lote insertado exitosamente: ${batch.length} canastillas`)

        insertados += batch.length
        setProgress(Math.round((insertados / canastillas.length) * 100))
      }

      console.log(`Todas las ${insertados} canastillas fueron creadas exitosamente`)

      onSuccess()
      onClose()

      // Resetear formulario
      setFormData({
        cantidad: '1',
        size: '',
        color: '',
        shape: '',
        condition: 'Bueno',
        current_location: '',
        current_area: '',
        tipo_propiedad: 'PROPIA',
      })
    } catch (err: any) {
      console.error('Error en handleSubmit:', err)
      setError(err.message || 'Error al crear el lote de canastillas')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  if (!isOpen) return null

  // Convertir cantidad a número para display
  const cantidadDisplay = Math.max(1, parseInt(formData.cantidad) || 1)

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
          className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-primary-600 px-6 py-4 sticky top-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Crear Lote de Canastillas
                </h3>
                <button
                  type="button"
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
            <div className="px-6 py-6 space-y-6">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {loading && (
                <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm font-semibold">Creando canastillas...</p>
                  <div className="mt-2 bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs mt-1">{progress}% completado</p>
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Se crearán <strong>{cantidadDisplay}</strong> canastilla(s) con códigos únicos generados automáticamente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cantidad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad de Canastillas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    placeholder="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Máximo: 10,000 canastillas</p>
                </div>

                {/* Tamaño */}
                <DynamicSelect
                  label="Tamaño"
                  value={formData.size}
                  options={tamaños.attributes}
                  onChange={(value) => setFormData({ ...formData, size: value })}
                  onAddNew={tamaños.addAttribute}
                  required
                  placeholder="Seleccionar tamaño..."
                />

                {/* Color */}
                <DynamicSelect
                  label="Color"
                  value={formData.color}
                  options={colores.attributes}
                  onChange={(value) => setFormData({ ...formData, color: value })}
                  onAddNew={colores.addAttribute}
                  required
                  placeholder="Seleccionar color..."
                />

                {/* Forma */}
                <DynamicSelect
                  label="Forma"
                  value={formData.shape}
                  options={formas.attributes}
                  onChange={(value) => setFormData({ ...formData, shape: value })}
                  onAddNew={formas.addAttribute}
                  placeholder="Seleccionar forma..."
                />

                {/* Condición */}
                <DynamicSelect
                  label="Condición"
                  value={formData.condition}
                  options={condiciones.attributes}
                  onChange={(value) => setFormData({ ...formData, condition: value })}
                  onAddNew={condiciones.addAttribute}
                  required
                  placeholder="Seleccionar condición..."
                />

                {/* Tipo de Propiedad - Select fijo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Propiedad <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipo_propiedad}
                    onChange={(e) => setFormData({ ...formData, tipo_propiedad: e.target.value as TipoPropiedad })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="PROPIA">Propia</option>
                    <option value="ALQUILADA">Alquilada</option>
                  </select>
                </div>

                {/* Ubicación */}
                <DynamicSelect
                  label="Ubicación"
                  value={formData.current_location}
                  options={ubicaciones.attributes}
                  onChange={(value) => setFormData({ ...formData, current_location: value })}
                  onAddNew={ubicaciones.addAttribute}
                  placeholder="Seleccionar ubicación..."
                />

                {/* Área */}
                <DynamicSelect
                  label="Área"
                  value={formData.current_area}
                  options={areas.attributes}
                  onChange={(value) => setFormData({ ...formData, current_area: value })}
                  onAddNew={areas.addAttribute}
                  placeholder="Seleccionar área..."
                />

              </div>

            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 sticky bottom-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading}
              >
                Crear {cantidadDisplay} Canastilla(s)
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}