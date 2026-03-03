import { useState, useEffect } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { DynamicSelect } from './DynamicSelect'
import { supabase } from '@/lib/supabase'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import type { Canastilla } from '@/types'

interface CanastillaModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  canastilla?: Canastilla | null
}

export function CanastillaModal({ isOpen, onClose, onSuccess, canastilla }: CanastillaModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cargar atributos dinámicos
  const colores = useCanastillaAttributes('COLOR')
  const tamaños = useCanastillaAttributes('SIZE')
  const ubicaciones = useCanastillaAttributes('UBICACION')
  const areas = useCanastillaAttributes('AREA')
  const condiciones = useCanastillaAttributes('CONDICION')
  const tiposPropiedad = useCanastillaAttributes('TIPO_PROPIEDAD')

  const [formData, setFormData] = useState({
    codigo: '',
    qr_code: '',
    size: 'GRANDE' as 'GRANDE' | 'MEDIANA',
    color: '',
    status: 'DISPONIBLE',
    condition: 'Bueno',
    current_location: '',
    current_area: '',
    tipo_propiedad: 'PROPIA' as 'PROPIA' | 'ALQUILADA',
    proveedor_nombre: '',
    proveedor_contacto: '',
    fecha_inicio_alquiler_proveedor: '',
    fecha_fin_alquiler_proveedor: '',
    notas_proveedor: '',
  })

  useEffect(() => {
    if (canastilla) {
      setFormData({
        codigo: canastilla.codigo,
        qr_code: canastilla.qr_code,
        size: canastilla.size,
        color: canastilla.color,
        status: canastilla.status,
        condition: canastilla.condition || 'Bueno',
        current_location: canastilla.current_location || '',
        current_area: canastilla.current_area || '',
        tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
        proveedor_nombre: canastilla.proveedor_nombre || '',
        proveedor_contacto: canastilla.proveedor_contacto || '',
        fecha_inicio_alquiler_proveedor: canastilla.fecha_inicio_alquiler_proveedor || '',
        fecha_fin_alquiler_proveedor: canastilla.fecha_fin_alquiler_proveedor || '',
        notas_proveedor: canastilla.notas_proveedor || '',
      })
    } else {
      // Generar código automático para nueva canastilla
      const randomCode = `CAN-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
      setFormData(prev => ({
        ...prev,
        codigo: randomCode,
        qr_code: `QR-${randomCode}`,
      }))
    }
  }, [canastilla, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (canastilla) {
        // Actualizar canastilla existente
        const { error } = await supabase
          .from('canastillas')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', canastilla.id)

        if (error) throw error
      } else {
        // Crear nueva canastilla
        const { error } = await supabase
          .from('canastillas')
          .insert([formData])

        if (error) throw error
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar la canastilla')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

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
          className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-primary-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {canastilla ? 'Editar Canastilla' : 'Nueva Canastilla'}
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
            <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Código */}
                <Input
                  label="Código"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  required
                  placeholder="CAN-0001"
                />

                {/* Código QR */}
                <Input
                  label="Código QR"
                  value={formData.qr_code}
                  onChange={(e) => setFormData({ ...formData, qr_code: e.target.value })}
                  required
                  placeholder="QR-CAN-0001"
                />

                {/* Tamaño */}
                <DynamicSelect
                  label="Tamaño"
                  value={formData.size}
                  options={tamaños.attributes}
                  onChange={(value) => setFormData({ ...formData, size: value as 'GRANDE' | 'MEDIANA' })}
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

                {/* Estado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="EN_USO_INTERNO">En Uso Interno</option>
                    <option value="EN_ALQUILER">En Alquiler</option>
                    <option value="EN_LAVADO">En Lavado</option>
                    <option value="EN_REPARACION">En Reparación</option>
                    <option value="FUERA_SERVICIO">Fuera de Servicio</option>
                    <option value="EXTRAVIADA">Extraviada</option>
                  </select>
                </div>

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

                {/* Tipo de Propiedad */}
                <DynamicSelect
                  label="Tipo de Propiedad"
                  value={formData.tipo_propiedad}
                  options={tiposPropiedad.attributes}
                  onChange={(value) => setFormData({ ...formData, tipo_propiedad: value as 'PROPIA' | 'ALQUILADA' })}
                  onAddNew={tiposPropiedad.addAttribute}
                  required
                  placeholder="Seleccionar tipo..."
                />

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

              {/* Sección de Proveedor - Solo si es ALQUILADA */}
              {formData.tipo_propiedad === 'ALQUILADA' && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-gray-800 mb-4">
                    Información del Proveedor
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nombre Proveedor */}
                    <Input
                      label="Nombre del Proveedor"
                      value={formData.proveedor_nombre}
                      onChange={(e) => setFormData({ ...formData, proveedor_nombre: e.target.value })}
                      placeholder="Empresa ABC"
                      required={formData.tipo_propiedad === 'ALQUILADA'}
                    />

                    {/* Contacto Proveedor */}
                    <Input
                      label="Contacto del Proveedor"
                      value={formData.proveedor_contacto}
                      onChange={(e) => setFormData({ ...formData, proveedor_contacto: e.target.value })}
                      placeholder="Tel/Email del proveedor"
                    />

                    {/* Fecha Inicio Alquiler */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha Inicio Contrato
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_inicio_alquiler_proveedor}
                        onChange={(e) => setFormData({ ...formData, fecha_inicio_alquiler_proveedor: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Fecha Fin Alquiler */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha Fin Contrato
                      </label>
                      <input
                        type="date"
                        value={formData.fecha_fin_alquiler_proveedor}
                        onChange={(e) => setFormData({ ...formData, fecha_fin_alquiler_proveedor: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {/* Notas Proveedor */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notas del Proveedor
                      </label>
                      <textarea
                        value={formData.notas_proveedor}
                        onChange={(e) => setFormData({ ...formData, notas_proveedor: e.target.value })}
                        placeholder="Información adicional sobre el contrato..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
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
                {canastilla ? 'Actualizar' : 'Crear'} Canastilla
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}