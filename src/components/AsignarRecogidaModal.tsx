/** @module AsignarRecogidaModal @description Modal para que el super_admin asigne una recogida de canastillas a un conductor. */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from './Button'
import type { Transfer, Canastilla } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { logAuditEvent } from '@/services/auditService'

interface LoteGroup {
  key: string
  size: string
  color: string
  totalDisponible: number
  cantidadRecoger: number
  canastillas: Array<{
    id: string
    transfer_item_id: string
    canastilla: Canastilla
  }>
}

interface Conductor {
  id: string
  first_name: string
  last_name: string
  email: string
  department?: string
}

interface AsignarRecogidaModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transfer: Transfer | null
}

export function AsignarRecogidaModal({ isOpen, onClose, onSuccess, transfer }: AsignarRecogidaModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadingConductores, setLoadingConductores] = useState(false)
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [conductores, setConductores] = useState<Conductor[]>([])
  const [selectedConductorId, setSelectedConductorId] = useState('')
  const [conductorSearch, setConductorSearch] = useState('')
  const [conductorDropdownOpen, setConductorDropdownOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { user } = useAuthStore()

  const selectedConductor = conductores.find(c => c.id === selectedConductorId)

  const filteredConductores = conductorSearch.trim()
    ? conductores.filter(c => {
        const term = conductorSearch.toLowerCase()
        return c.first_name?.toLowerCase().includes(term) ||
               c.last_name?.toLowerCase().includes(term) ||
               c.email?.toLowerCase().includes(term)
      })
    : conductores

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setConductorDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTransferItems = useCallback(async () => {
    if (!transfer) return
    setLoadingItems(true)
    setError('')

    try {
      // Obtener IDs de canastillas ya devueltas
      const returnedIds = new Set<string>()
      const { data: existingReturns } = await supabase
        .from('transfer_returns')
        .select('id, transfer_return_items(canastilla_id)')
        .eq('transfer_id', transfer.id)

      if (existingReturns) {
        for (const ret of existingReturns) {
          for (const item of (ret.transfer_return_items as Array<{ canastilla_id: string }>) || []) {
            returnedIds.add(item.canastilla_id)
          }
        }
      }

      // Obtener IDs ya asignados en pickups pendientes
      const assignedIds = new Set<string>()
      const { data: pendingPickups } = await supabase
        .from('pickup_assignments')
        .select('id, pickup_assignment_items(canastilla_id)')
        .eq('transfer_id', transfer.id)
        .eq('status', 'PENDIENTE')

      if (pendingPickups) {
        for (const p of pendingPickups) {
          for (const item of (p.pickup_assignment_items as Array<{ canastilla_id: string }>) || []) {
            assignedIds.add(item.canastilla_id)
          }
        }
      }

      // Cargar transfer_items
      const PAGE_SIZE = 1000
      let allItems: Array<{ id: string; canastilla: Canastilla }> = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: err } = await supabase
          .from('transfer_items')
          .select('id, canastilla:canastillas(id, codigo, size, color, shape, status, tipo_propiedad)')
          .eq('transfer_id', transfer.id)
          .range(offset, offset + PAGE_SIZE - 1)

        if (err) throw err
        if (data && data.length > 0) {
          allItems = [...allItems, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Filtrar: pendientes (no devueltas ni asignadas)
      const pending = allItems
        .filter(item => item.canastilla && !returnedIds.has(item.canastilla.id) && !assignedIds.has(item.canastilla.id))
        .map(item => ({ id: item.canastilla.id, transfer_item_id: item.id, canastilla: item.canastilla }))

      // Agrupar por size+color
      const grouped: Record<string, LoteGroup> = {}
      for (const item of pending) {
        const key = `${item.canastilla.size}-${item.canastilla.color}`
        if (!grouped[key]) {
          grouped[key] = { key, size: item.canastilla.size, color: item.canastilla.color, totalDisponible: 0, cantidadRecoger: 0, canastillas: [] }
        }
        grouped[key].totalDisponible++
        grouped[key].canastillas.push(item)
      }

      setLotes(Object.values(grouped))
    } catch (err: any) {
      setError('Error al cargar canastillas: ' + err.message)
    } finally {
      setLoadingItems(false)
    }
  }, [transfer])

  const loadConductores = async () => {
    setLoadingConductores(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, department')
        .eq('role', 'conductor')
        .eq('is_active', true)
        .order('first_name')

      if (error) throw error
      setConductores(data || [])
    } catch (err) {
      console.error('Error fetching conductores:', err)
    } finally {
      setLoadingConductores(false)
    }
  }

  useEffect(() => {
    if (isOpen && transfer) {
      loadTransferItems()
      loadConductores()
    }
  }, [isOpen, transfer, loadTransferItems])

  const totalRecoger = lotes.reduce((sum, l) => sum + l.cantidadRecoger, 0)
  const totalPendiente = lotes.reduce((sum, l) => sum + l.totalDisponible, 0)

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev => prev.map(l => l.key === key ? { ...l, cantidadRecoger: Math.min(Math.max(0, cantidad), l.totalDisponible) } : l))
  }

  const handleTodo = (key: string) => {
    setLotes(prev => prev.map(l => l.key === key ? { ...l, cantidadRecoger: l.totalDisponible } : l))
  }

  const handleTodoGlobal = () => {
    setLotes(prev => prev.map(l => ({ ...l, cantidadRecoger: l.totalDisponible })))
  }

  const handleLimpiar = () => {
    setLotes(prev => prev.map(l => ({ ...l, cantidadRecoger: 0 })))
  }

  const handleConfirm = async () => {
    if (!selectedConductorId) {
      setError('Selecciona un conductor')
      return
    }
    if (totalRecoger === 0) {
      setError('Selecciona al menos una canastilla')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Recopilar IDs
      const canastillaIds: string[] = []
      const transferItemIds: string[] = []
      for (const lote of lotes) {
        if (lote.cantidadRecoger > 0) {
          const sel = lote.canastillas.slice(0, lote.cantidadRecoger)
          for (const item of sel) {
            canastillaIds.push(item.id)
            transferItemIds.push(item.transfer_item_id)
          }
        }
      }

      // Crear pickup_assignment
      const { data: pickup, error: pickupErr } = await supabase
        .from('pickup_assignments')
        .insert({
          transfer_id: transfer!.id,
          assigned_to: selectedConductorId,
          assigned_by: user!.id,
          status: 'PENDIENTE',
          notes: notes || null,
        })
        .select()
        .single()

      if (pickupErr) throw pickupErr

      // Crear pickup_assignment_items
      const items = canastillaIds.map((cId, i) => ({
        pickup_assignment_id: pickup.id,
        canastilla_id: cId,
        transfer_item_id: transferItemIds[i] || null,
      }))

      const BATCH = 500
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH)
        const { error: itemsErr } = await supabase.from('pickup_assignment_items').insert(batch)
        if (itemsErr) throw itemsErr
      }

      // Notificar al conductor
      const conductorName = selectedConductor ? `${selectedConductor.first_name} ${selectedConductor.last_name}` : ''
      const clientName = transfer!.external_recipient_name || 'Cliente Externo'

      await supabase.from('notifications').insert([{
        user_id: selectedConductorId,
        type: 'RECOGIDA_ASIGNADA',
        title: 'Recogida pendiente asignada',
        message: `Se te asignó una recogida de ${canastillaIds.length} canastilla(s) del cliente ${clientName}.${transfer!.remision_number ? ' Remisión: ' + transfer!.remision_number : ''}`,
        related_id: pickup.id,
      }])

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'CREATE',
        module: 'recogidas',
        description: `Recogida asignada a ${conductorName}. ${canastillaIds.length} canastilla(s) del cliente ${clientName}.`,
        details: { pickup_id: pickup.id, transfer_id: transfer!.id, conductor_id: selectedConductorId, cantidad: canastillaIds.length },
      })

      alert(`✅ Recogida asignada a ${conductorName} (${canastillaIds.length} canastillas)`)
      onSuccess()
      handleClose()
    } catch (err: any) {
      setError('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setLotes([])
    setError('')
    setSelectedConductorId('')
    setConductorSearch('')
    setConductorDropdownOpen(false)
    setNotes('')
    onClose()
  }

  if (!isOpen || !transfer) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose} />
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-orange-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">Asignar Recogida</h3>
                <p className="text-orange-200 text-xs mt-1">
                  {transfer.external_recipient_name || 'Cliente'} · {transfer.remision_number || 'Sin remisión'}
                </p>
              </div>
              <button type="button" onClick={handleClose} className="text-white hover:text-gray-200 p-1">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Selector de conductor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conductor asignado *</label>
              {loadingConductores ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  {selectedConductor && !conductorDropdownOpen ? (
                    <div
                      onClick={() => setConductorDropdownOpen(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{selectedConductor.first_name} {selectedConductor.last_name}</span>
                        <span className="text-gray-500 ml-2 text-sm">- {selectedConductor.email}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={conductorSearch}
                      onChange={(e) => { setConductorSearch(e.target.value); setConductorDropdownOpen(true) }}
                      onFocus={() => setConductorDropdownOpen(true)}
                      placeholder="Buscar conductor..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  )}
                  {conductorDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredConductores.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron conductores</div>
                      ) : (
                        filteredConductores.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedConductorId(c.id); setConductorDropdownOpen(false); setConductorSearch('') }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors ${selectedConductorId === c.id ? 'bg-orange-50 border-l-2 border-orange-500' : ''}`}
                          >
                            <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                            <p className="text-xs text-gray-500">{c.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Canastillas por lote */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Canastillas a recoger</label>
                {!loadingItems && lotes.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" onClick={handleTodoGlobal} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Todas</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={handleLimpiar} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Limpiar</button>
                  </div>
                )}
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                </div>
              ) : lotes.length === 0 ? (
                <div className="flex items-center justify-center h-24 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-500">No hay canastillas pendientes de recoger</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                    <div className="col-span-5">Lote</div>
                    <div className="col-span-2 text-center">Pendientes</div>
                    <div className="col-span-3 text-center">Recoger</div>
                    <div className="col-span-2 text-center">Acción</div>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {lotes.map(lote => (
                      <div key={lote.key} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                        <div className="col-span-5 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: lote.color.toLowerCase().replace(/ /g, '') }} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{lote.size} · {lote.color}</p>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-semibold text-gray-700">{lote.totalDisponible}</span>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number" min="0" max={lote.totalDisponible}
                            value={lote.cantidadRecoger || ''}
                            onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <button type="button" onClick={() => handleTodo(lote.key)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Todo</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="col-span-5 text-sm font-semibold text-gray-900">TOTAL</div>
                    <div className="col-span-2 text-center text-sm font-semibold text-gray-700">{totalPendiente}</div>
                    <div className="col-span-3 text-center text-sm font-bold text-orange-600">{totalRecoger}</div>
                    <div className="col-span-2"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Instrucciones para el conductor..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {totalRecoger > 0 && selectedConductor && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800">
                  Se asignarán <strong>{totalRecoger}</strong> canastilla{totalRecoger !== 1 ? 's' : ''} a <strong>{selectedConductor.first_name} {selectedConductor.last_name}</strong> para recoger del cliente <strong>{transfer.external_recipient_name}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
            <Button onClick={handleConfirm} loading={loading} disabled={!selectedConductorId || totalRecoger === 0}>
              Asignar Recogida
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
