/** @module CrearRutaModal @description Modal para crear una nueva ruta de entrega con paradas. */
import { useState } from 'react'
import type { StopType } from '@/types'

interface Stop {
  type: StopType
  client_name: string
  address: string
  latitude: number | null
  longitude: number | null
  phone: string
  notes: string
  canastillas_qty: number
}

interface CrearRutaModalProps {
  drivers: { id: string; name: string }[]
  onClose: () => void
  onCreate: (params: {
    name: string
    description?: string
    driverId?: string
    driverName?: string
    scheduledDate: string
    notes?: string
    stops: Stop[]
  }) => Promise<void>
}

export function CrearRutaModal({ drivers, onClose, onCreate }: CrearRutaModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [driverId, setDriverId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [stops, setStops] = useState<Stop[]>([
    { type: 'ENTREGA', client_name: '', address: '', latitude: null, longitude: null, phone: '', notes: '', canastillas_qty: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)

  const addStop = () => {
    setStops(prev => [...prev, {
      type: 'ENTREGA',
      client_name: '',
      address: '',
      latitude: null,
      longitude: null,
      phone: '',
      notes: '',
      canastillas_qty: 0,
    }])
  }

  const removeStop = (index: number) => {
    if (stops.length <= 1) return
    setStops(prev => prev.filter((_, i) => i !== index))
  }

  const updateStop = (index: number, field: keyof Stop, value: string | number | null) => {
    setStops(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSubmit = async () => {
    if (!name.trim() || !scheduledDate) return
    const validStops = stops.filter(s => s.client_name.trim() && s.address.trim())
    if (validStops.length === 0) return

    setSubmitting(true)
    try {
      const selectedDriver = drivers.find(d => d.id === driverId)
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        driverId: driverId || undefined,
        driverName: selectedDriver?.name,
        scheduledDate,
        notes: notes.trim() || undefined,
        stops: validStops,
      })
    } catch (error) {
      console.error('Error creating route:', error)
      alert('Error al crear la ruta')
    } finally {
      setSubmitting(false)
    }
  }

  const validStopsCount = stops.filter(s => s.client_name.trim() && s.address.trim()).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Ruta</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Info básica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la ruta *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Ruta Norte - Mañana"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha programada *</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conductor</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="">Sin asignar</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción breve..."
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          {/* Paradas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Paradas ({validStopsCount})
              </h3>
              <button
                onClick={addStop}
                className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-800"
              >
                + Agregar parada
              </button>
            </div>

            <div className="space-y-4">
              {stops.map((stop, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parada {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={stop.type}
                        onChange={(e) => updateStop(idx, 'type', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="ENTREGA">📦 Entrega</option>
                        <option value="RECOLECCION">🔄 Recolección</option>
                      </select>
                      {stops.length > 1 && (
                        <button onClick={() => removeStop(idx)} className="text-red-400 hover:text-red-600 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={stop.client_name}
                      onChange={(e) => updateStop(idx, 'client_name', e.target.value)}
                      placeholder="Cliente *"
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={stop.address}
                      onChange={(e) => updateStop(idx, 'address', e.target.value)}
                      placeholder="Dirección *"
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={stop.phone}
                      onChange={(e) => updateStop(idx, 'phone', e.target.value)}
                      placeholder="Teléfono"
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={stop.canastillas_qty || ''}
                      onChange={(e) => updateStop(idx, 'canastillas_qty', parseInt(e.target.value) || 0)}
                      placeholder="Cantidad canastillas"
                      min="0"
                      className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={stop.notes}
                        onChange={(e) => updateStop(idx, 'notes', e.target.value)}
                        placeholder="Notas de la parada..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notas generales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas generales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones adicionales para el conductor..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !scheduledDate || validStopsCount === 0 || submitting}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creando...' : 'Crear Ruta'}
          </button>
        </div>
      </div>
    </div>
  )
}
