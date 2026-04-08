/** @module AgregarCanastillasAlquilerModal @description Modal para agregar canastillas adicionales a un alquiler existente. */
import { useState, useEffect } from 'react'
import { Button } from './Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { logAuditEvent } from '@/services/auditService'
import type { Rental, Canastilla } from '@/types'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  tipo_propiedad: string
  totalDisponible: number
  cantidadAgregar: number
  canastillas: Canastilla[]
}

interface AgregarCanastillasAlquilerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  rental: Rental | null
}

export function AgregarCanastillasAlquilerModal({ isOpen, onClose, onSuccess, rental }: AgregarCanastillasAlquilerModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<LoteGroup[]>([])

  // Selector de usuario
  const [usuarios, setUsuarios] = useState<Array<{ id: string; email: string; first_name: string; last_name: string; department?: string }>>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  const { user } = useAuthStore()

  useEffect(() => {
    if (isOpen && rental) {
      fetchUsuarios()
    }
  }, [isOpen, rental])

  useEffect(() => {
    if (isOpen && rental && selectedUserId) {
      fetchCanastillasDisponibles()
    }
  }, [isOpen, rental, selectedUserId])

  const fetchUsuarios = async () => {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, department')
        .eq('is_active', true)
        .order('first_name')
      if (error) throw error
      setUsuarios(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const selectedUser = usuarios.find(u => u.id === selectedUserId)
  const filteredUsers = userSearch.trim()
    ? usuarios.filter(u => {
        const term = userSearch.toLowerCase()
        return u.first_name?.toLowerCase().includes(term) ||
               u.last_name?.toLowerCase().includes(term) ||
               u.email?.toLowerCase().includes(term) ||
               u.department?.toLowerCase().includes(term)
      })
    : usuarios

  const fetchCanastillasDisponibles = async () => {
    if (!selectedUserId) return
    setLoadingLotes(true)
    setError('')

    try {
      // Cargar canastillas DISPONIBLES del usuario seleccionado
      const PAGE_SIZE = 1000
      let allCanastillas: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: fetchErr } = await supabase
          .from('canastillas')
          .select('id, codigo, size, color, shape, tipo_propiedad, status')
          .eq('current_owner_id', selectedUserId)
          .eq('status', 'DISPONIBLE')
          .order('color', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (fetchErr) throw fetchErr

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Agrupar por size + color + shape + tipo_propiedad
      const grouped: Record<string, LoteGroup> = {}

      for (const canastilla of allCanastillas) {
        const key = `${canastilla.size}-${canastilla.color}-${canastilla.shape || ''}-${canastilla.tipo_propiedad || 'PROPIA'}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: canastilla.size,
            color: canastilla.color,
            shape: canastilla.shape || '',
            tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
            totalDisponible: 0,
            cantidadAgregar: 0,
            canastillas: [],
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(canastilla)
      }

      setLotes(Object.values(grouped))
    } catch (err: any) {
      setError('Error al cargar canastillas: ' + err.message)
    } finally {
      setLoadingLotes(false)
    }
  }

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadAgregar: Math.min(Math.max(0, cantidad), lote.totalDisponible) }
          : lote
      )
    )
  }

  const handleSeleccionarTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadAgregar: lote.totalDisponible }
          : lote
      )
    )
  }

  const totalAgregar = lotes.reduce((sum, lote) => sum + lote.cantidadAgregar, 0)

  const handleAgregar = async () => {
    if (!rental || !user || totalAgregar === 0) return

    setLoading(true)
    setError('')

    try {
      // Recopilar IDs seleccionados
      const canastillaIds: string[] = []
      for (const lote of lotes) {
        if (lote.cantidadAgregar > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadAgregar)
          canastillaIds.push(...seleccionadas.map(c => c.id))
        }
      }

      // 1. Insertar rental_items nuevos (en lotes de 500)
      const rentalItems = canastillaIds.map(canastillaId => ({
        rental_id: rental.id,
        canastilla_id: canastillaId,
      }))

      const BATCH_SIZE = 500
      for (let i = 0; i < rentalItems.length; i += BATCH_SIZE) {
        const batch = rentalItems.slice(i, i + BATCH_SIZE)
        const { error: itemsError } = await supabase
          .from('rental_items')
          .insert(batch)
        if (itemsError) throw itemsError
      }

      // 2. Actualizar canastillas a EN_ALQUILER
      for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
        const batch = canastillaIds.slice(i, i + BATCH_SIZE)
        const { error: updateErr } = await supabase
          .from('canastillas')
          .update({ status: 'EN_ALQUILER' })
          .in('id', batch)
        if (updateErr) throw updateErr
      }

      // 3. Actualizar pending_items_count del rental
      const currentPending = (rental as any).pending_items_count ?? (rental as any).items_count ?? 0
      const { error: rentalUpdateErr } = await supabase
        .from('rentals')
        .update({
          pending_items_count: currentPending + canastillaIds.length,
        })
        .eq('id', rental.id)

      if (rentalUpdateErr) throw rentalUpdateErr

      alert(`Se agregaron ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''} al alquiler ${rental.remision_number}`)

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'UPDATE',
        module: 'alquileres',
        description: `Agregar ${canastillaIds.length} canastilla(s) al alquiler ${rental.remision_number}`,
        details: { rental_id: rental.id, remision: rental.remision_number, cantidad_agregada: canastillaIds.length },
      })

      onSuccess()
      handleClose()
    } catch (err: any) {
      setError('Error al agregar canastillas: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setLotes([])
    setError('')
    setSelectedUserId('')
    setUserSearch('')
    setUserDropdownOpen(false)
    onClose()
  }

  if (!isOpen || !rental) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose} />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  Agregar Canastillas al Alquiler
                </h3>
                <p className="text-primary-200 text-xs mt-1">
                  {rental.sale_point?.name} · {rental.remision_number}
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

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Selecciona las canastillas adicionales para el alquiler de <strong>{rental.sale_point?.name}</strong>.
                Se agregarán al alquiler existente con remisión <strong>{rental.remision_number}</strong>.
              </p>
            </div>

            {/* Selector de Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario / Origen de Canastillas *</label>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="relative">
                  {selectedUser && !userDropdownOpen ? (
                    <div
                      onClick={() => setUserDropdownOpen(true)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</span>
                        <span className="text-gray-500 ml-2 text-sm">- {selectedUser.email}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserDropdownOpen(true) }}
                      onFocus={() => setUserDropdownOpen(true)}
                      placeholder="Buscar usuario por nombre o correo..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}

                  {userDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron usuarios</div>
                      ) : (
                        filteredUsers.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(u.id)
                              setUserDropdownOpen(false)
                              setUserSearch('')
                            }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors ${
                              selectedUserId === u.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                            <p className="text-xs text-gray-500">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selector de cantidades por lote */}
            {loadingLotes ? (
              <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Cargando canastillas...</p>
                </div>
              </div>
            ) : lotes.length === 0 ? (
              <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-500">No tienes canastillas disponibles para agregar</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                  <div className="col-span-5">Lote</div>
                  <div className="col-span-2 text-center">Disponibles</div>
                  <div className="col-span-3 text-center">Agregar</div>
                  <div className="col-span-2 text-center">Acción</div>
                </div>

                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {lotes.map((lote) => (
                    <div key={lote.key} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                      <div className="col-span-5 flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: lote.color.toLowerCase().replace(/ /g, '') }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {lote.size} · {lote.color}
                          </p>
                          <p className="text-xs text-gray-500">
                            {lote.shape || 'Sin forma'} ·{' '}
                            <span className={lote.tipo_propiedad === 'PROPIA' ? 'text-green-700' : 'text-amber-700'}>
                              {lote.tipo_propiedad === 'PROPIA' ? 'Propia' : 'Alquilada'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-sm font-semibold text-gray-700">{lote.totalDisponible}</span>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          max={lote.totalDisponible}
                          value={lote.cantidadAgregar || ''}
                          onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div className="col-span-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleSeleccionarTodo(lote.key)}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Todo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="col-span-5 text-sm font-semibold text-gray-900">TOTAL A AGREGAR</div>
                  <div className="col-span-2 text-center text-sm font-semibold text-gray-700">
                    {lotes.reduce((sum, l) => sum + l.totalDisponible, 0)}
                  </div>
                  <div className="col-span-3 text-center text-sm font-bold text-primary-600">
                    {totalAgregar}
                  </div>
                  <div className="col-span-2"></div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="w-full sm:w-auto text-sm">
              Cancelar
            </Button>
            <Button
              onClick={handleAgregar}
              loading={loading}
              disabled={loading || loadingLotes || totalAgregar === 0}
              className="w-full sm:w-auto text-sm"
            >
              {loading ? 'Agregando...' : `Agregar ${totalAgregar} canastilla${totalAgregar !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
