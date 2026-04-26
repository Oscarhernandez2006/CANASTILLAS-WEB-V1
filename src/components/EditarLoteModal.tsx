/** @module EditarLoteModal @description Modal para editar los atributos de un lote (grupo) de canastillas en bloque. */
import { useState, useEffect } from 'react'
import { Button } from './Button'
import { DynamicSelect } from './DynamicSelect'
import { AuthCodeGate } from './AuthCodeGate'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import { logAuditEvent } from '@/services/auditService'
import type { Canastilla } from '@/types'

export interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  condition: string
  status: string
  tipo_propiedad: string
  current_location: string
  cantidad: number
  ids: string[]
}

interface EditarLoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  lote: LoteGroup | null
}

export function EditarLoteModal({ isOpen, onClose, onSuccess, lote }: EditarLoteModalProps) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAuthGate, setShowAuthGate] = useState(false)

  // Cargar atributos dinámicos
  const colores = useCanastillaAttributes('COLOR')
  const tamaños = useCanastillaAttributes('SIZE')
  const formas = useCanastillaAttributes('FORMA')
  const ubicaciones = useCanastillaAttributes('UBICACION')
  const areas = useCanastillaAttributes('AREA')
  const condiciones = useCanastillaAttributes('CONDICION')
  const tiposPropiedad = useCanastillaAttributes('TIPO_PROPIEDAD')

  const [formData, setFormData] = useState({
    size: '',
    color: '',
    shape: '',
    condition: '',
    tipo_propiedad: 'PROPIA' as 'PROPIA' | 'ALQUILADA',
    current_location: '',
  })

  useEffect(() => {
    if (lote) {
      setFormData({
        size: lote.size,
        color: lote.color,
        shape: lote.shape || '',
        condition: lote.condition,
        tipo_propiedad: (lote.tipo_propiedad || 'PROPIA') as 'PROPIA' | 'ALQUILADA',
        current_location: lote.current_location || '',
      })
      setError('')
      setSuccess('')
    }
  }, [lote, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowAuthGate(true)
  }

  const handleAuthorizedSubmit = async () => {
    setShowAuthGate(false)
    if (!lote) return
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!formData.size.trim()) throw new Error('El tamaño es requerido')
      if (!formData.color.trim()) throw new Error('El color es requerido')
      if (!formData.condition.trim()) throw new Error('La condición es requerida')

      // Construir los campos que cambiaron
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      }
      const cambios: string[] = []

      if (formData.size !== lote.size) {
        updateData.size = formData.size
        cambios.push(`Tamaño: ${lote.size} → ${formData.size}`)
      }
      if (formData.color !== lote.color) {
        updateData.color = formData.color
        cambios.push(`Color: ${lote.color} → ${formData.color}`)
      }
      if ((formData.shape || '') !== (lote.shape || '')) {
        updateData.shape = formData.shape || null
        cambios.push(`Forma: ${lote.shape || 'N/A'} → ${formData.shape || 'N/A'}`)
      }
      if (formData.condition !== lote.condition) {
        updateData.condition = formData.condition
        cambios.push(`Condición: ${lote.condition} → ${formData.condition}`)
      }
      if (formData.tipo_propiedad !== lote.tipo_propiedad) {
        updateData.tipo_propiedad = formData.tipo_propiedad
        cambios.push(`Tipo: ${lote.tipo_propiedad} → ${formData.tipo_propiedad}`)
      }
      if ((formData.current_location || '') !== (lote.current_location || '')) {
        updateData.current_location = formData.current_location || null
        cambios.push(`Ubicación: ${lote.current_location || 'N/A'} → ${formData.current_location || 'N/A'}`)
      }

      if (cambios.length === 0) {
        setError('No se detectaron cambios')
        setLoading(false)
        return
      }

      // Actualizar en bloques de 500 IDs por limitación de Supabase
      const BATCH_SIZE = 500
      for (let i = 0; i < lote.ids.length; i += BATCH_SIZE) {
        const batchIds = lote.ids.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update(updateData)
          .in('id', batchIds)

        if (updateError) throw updateError
      }

      // Auditoría
      if (user) {
        await logAuditEvent({
          userId: user.id,
          userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          userRole: user.role,
          action: 'UPDATE',
          module: 'canastillas',
          description: `Editar lote de ${lote.cantidad} canastillas`,
          details: { cantidad: lote.cantidad, cambios },
        })
      }

      setSuccess(`${lote.cantidad} canastillas actualizadas correctamente`)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el lote')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !lote) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500/75 dark:bg-gray-900/80" onClick={onClose} />

        <div
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl text-left shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Editar Lote</h3>
                  <p className="text-sm text-white/70 mt-0.5">{lote.cantidad} canastillas serán actualizadas</p>
                </div>
                <button type="button" onClick={onClose} className="p-1 text-white/80 hover:text-white rounded-lg transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 sm:px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-400 px-4 py-3 rounded-r-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-400 px-4 py-3 rounded-r-lg text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              {/* Info del lote actual */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">Lote actual</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600/70 dark:text-blue-400/70">Estado:</span>{' '}
                    <span className="font-medium text-blue-900 dark:text-blue-200">{lote.status}</span>
                  </div>
                  <div>
                    <span className="text-blue-600/70 dark:text-blue-400/70">Cantidad:</span>{' '}
                    <span className="font-medium text-blue-900 dark:text-blue-200">{lote.cantidad}</span>
                  </div>
                  <div>
                    <span className="text-blue-600/70 dark:text-blue-400/70">Tipo:</span>{' '}
                    <span className="font-medium text-blue-900 dark:text-blue-200">{lote.tipo_propiedad || 'PROPIA'}</span>
                  </div>
                </div>
              </div>

              {/* Campos editables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DynamicSelect
                  label="Tamaño"
                  value={formData.size}
                  options={tamaños.attributes}
                  onChange={(value) => setFormData({ ...formData, size: value as 'GRANDE' | 'MEDIANA' })}
                  onAddNew={tamaños.addAttribute}
                  required
                  placeholder="Seleccionar tamaño..."
                />

                <DynamicSelect
                  label="Color"
                  value={formData.color}
                  options={colores.attributes}
                  onChange={(value) => setFormData({ ...formData, color: value })}
                  onAddNew={colores.addAttribute}
                  required
                  placeholder="Seleccionar color..."
                />

                <DynamicSelect
                  label="Forma"
                  value={formData.shape}
                  options={formas.attributes}
                  onChange={(value) => setFormData({ ...formData, shape: value })}
                  onAddNew={formas.addAttribute}
                  placeholder="Seleccionar forma..."
                />

                <DynamicSelect
                  label="Condición"
                  value={formData.condition}
                  options={condiciones.attributes}
                  onChange={(value) => setFormData({ ...formData, condition: value })}
                  onAddNew={condiciones.addAttribute}
                  required
                  placeholder="Seleccionar condición..."
                />

                <DynamicSelect
                  label="Tipo de Propiedad"
                  value={formData.tipo_propiedad}
                  options={tiposPropiedad.attributes}
                  onChange={(value) => setFormData({ ...formData, tipo_propiedad: value as 'PROPIA' | 'ALQUILADA' })}
                  onAddNew={tiposPropiedad.addAttribute}
                  required
                  placeholder="Seleccionar tipo..."
                />

                <DynamicSelect
                  label="Ubicación"
                  value={formData.current_location}
                  options={ubicaciones.attributes}
                  onChange={(value) => setFormData({ ...formData, current_location: value })}
                  onAddNew={ubicaciones.addAttribute}
                  placeholder="Seleccionar ubicación..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 sm:px-6 py-4 flex items-center justify-between rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Se actualizarán <span className="font-semibold text-gray-700 dark:text-gray-300">{lote.cantidad}</span> canastillas
              </p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" loading={loading} disabled={loading || !!success}>
                  Actualizar Lote
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AuthCodeGate
        isOpen={showAuthGate}
        onAuthorized={handleAuthorizedSubmit}
        onCancel={() => setShowAuthGate(false)}
        actionDescription={`Editar lote de ${lote.cantidad} canastillas`}
        loading={loading}
      />
    </div>
  )
}
