/**
 * @module RecogidaConductorModal
 * @description Modal para que el conductor realice recogida de canastillas de un cliente.
 * El conductor selecciona un cliente, elige canastillas por lote, el cliente firma,
 * se genera remisión y las canastillas pasan al inventario del conductor.
 */
import { useState, useEffect, useRef } from 'react'
import { Button } from './Button'
import { FirmaDigitalModal } from './FirmaDigitalModal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { logAuditEvent } from '@/services/auditService'
import type { SignatureData } from '@/types'

interface SalePointOption {
  id: string
  name: string
  contact_name: string
  contact_phone: string
  address: string
  city: string
}

interface OwnerGroup {
  ownerId: string
  ownerName: string
  canastillas: CanastillaItem[]
}

interface CanastillaItem {
  id: string
  codigo: string
  size: string
  color: string
  current_owner_id: string
}

interface LoteGroup {
  key: string
  size: string
  color: string
  ownerId: string
  ownerName: string
  totalDisponible: number
  cantidadRecoger: number
  canastillas: CanastillaItem[]
}

interface RecogidaConductorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RecogidaConductorModal({ isOpen, onClose, onSuccess }: RecogidaConductorModalProps) {
  const { user } = useAuthStore()
  const [step, setStep] = useState<'cliente' | 'canastillas' | 'metodo' | 'firma' | 'codigo'>('cliente')
  const [loading, setLoading] = useState(false)
  const [firmaLoading, setFirmaLoading] = useState(false)

  // Paso 1: Seleccionar cliente
  const [salePoints, setSalePoints] = useState<SalePointOption[]>([])
  const [loadingSalePoints, setLoadingSalePoints] = useState(false)
  const [selectedSalePoint, setSelectedSalePoint] = useState<SalePointOption | null>(null)
  const [searchClient, setSearchClient] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Paso 2: Seleccionar canastillas
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  // Paso 3: Método de autorización
  // Paso 3a: Firma
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  // Paso 3b: Código de autorización
  const [authCode, setAuthCode] = useState('')
  const [authError, setAuthError] = useState('')
  const [validatingCode, setValidatingCode] = useState(false)

  // Modal resultado
  const [resultModal, setResultModal] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string }>({
    show: false, type: 'success', title: '', message: '',
  })

  useEffect(() => {
    if (isOpen) {
      resetForm()
      fetchSalePoints()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resetForm = () => {
    setStep('cliente')
    setSelectedSalePoint(null)
    setSearchClient('')
    setLotes([])
    setLoading(false)
    setAuthCode('')
    setAuthError('')
  }

  const fetchSalePoints = async () => {
    setLoadingSalePoints(true)
    try {
      const { data, error } = await supabase
        .from('sale_points')
        .select('id, name, contact_name, contact_phone, address, city')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      setSalePoints(data || [])
    } catch (err) {
      console.error('Error fetching sale points:', err)
    } finally {
      setLoadingSalePoints(false)
    }
  }

  const handleSelectClient = (sp: SalePointOption) => {
    setSelectedSalePoint(sp)
    setSearchClient(sp.name)
    setDropdownOpen(false)
  }

  const handleContinueToCanastillas = async () => {
    if (!selectedSalePoint) return
    setStep('canastillas')
    await fetchCanastillasDisponibles()
  }

  const fetchCanastillasDisponibles = async () => {
    if (!selectedSalePoint) return
    setLoadingLotes(true)
    try {
      let allCanastillas: CanastillaItem[] = []
      const PAGE_SIZE = 1000

      // 1. Buscar canastillas por current_location = nombre del cliente (alquiler)
      let offset = 0
      let hasMore = true
      while (hasMore) {
        const { data, error } = await supabase
          .from('canastillas')
          .select('id, codigo, size, color, current_owner_id')
          .eq('current_location', selectedSalePoint.name)
          .order('color', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // 2. Buscar canastillas por usuario virtual del cliente (traspasos externos)
      const { data: transfers } = await supabase
        .from('transfers')
        .select('to_user_id')
        .eq('sale_point_id', selectedSalePoint.id)
        .eq('is_external_transfer', true)
        .not('to_user_id', 'is', null)

      if (transfers && transfers.length > 0) {
        const externalUserIds = [...new Set(transfers.map(t => t.to_user_id))]
        for (const extUserId of externalUserIds) {
          offset = 0
          hasMore = true
          while (hasMore) {
            const { data, error } = await supabase
              .from('canastillas')
              .select('id, codigo, size, color, current_owner_id')
              .eq('current_owner_id', extUserId)
              .order('color', { ascending: true })
              .order('id', { ascending: true })
              .range(offset, offset + PAGE_SIZE - 1)
            if (error) throw error
            if (data && data.length > 0) {
              allCanastillas = [...allCanastillas, ...data]
              offset += PAGE_SIZE
              hasMore = data.length === PAGE_SIZE
            } else {
              hasMore = false
            }
          }
        }
      }

      // Deduplicar
      const uniqueMap = new Map(allCanastillas.map(c => [c.id, c]))
      allCanastillas = Array.from(uniqueMap.values())

      if (allCanastillas.length === 0) {
        setLotes([])
        setLoadingLotes(false)
        return
      }

      // Agrupar por size + color
      const groupMap: Record<string, LoteGroup> = {}
      for (const c of allCanastillas) {
        const key = `${c.size}_${c.color}`
        if (!groupMap[key]) {
          groupMap[key] = {
            key,
            size: c.size,
            color: c.color,
            ownerId: c.current_owner_id!,
            ownerName: selectedSalePoint.name,
            totalDisponible: 0,
            cantidadRecoger: 0,
            canastillas: [],
          }
        }
        groupMap[key].totalDisponible++
        groupMap[key].canastillas.push(c as CanastillaItem)
      }

      setLotes(Object.values(groupMap).sort((a, b) => {
        if (a.size !== b.size) return a.size.localeCompare(b.size)
        return a.color.localeCompare(b.color)
      }))
    } catch (err) {
      console.error('Error fetching canastillas:', err)
    } finally {
      setLoadingLotes(false)
    }
  }

  const updateLoteCantidad = (key: string, cantidad: number) => {
    setLotes(prev => prev.map(l =>
      l.key === key
        ? { ...l, cantidadRecoger: Math.max(0, Math.min(cantidad, l.totalDisponible)) }
        : l
    ))
  }

  const totalSeleccionadas = lotes.reduce((sum, l) => sum + l.cantidadRecoger, 0)

  const handleContinueToFirma = () => {
    if (totalSeleccionadas === 0) {
      alert('Selecciona al menos una canastilla para recoger')
      return
    }
    setStep('metodo')
  }

  const handleSelectFirma = () => {
    setStep('firma')
    setShowFirmaModal(true)
  }

  const handleSelectCodigo = () => {
    setStep('codigo')
    setAuthCode('')
    setAuthError('')
  }

  /** Procesa la recogida (compartido entre firma y código de autorización) */
  const processRecogida = async (signatureData?: SignatureData, authorizationCode?: string) => {
    if (!user || !selectedSalePoint) return
    setFirmaLoading(true)
    setShowFirmaModal(false)
    setLoading(true)

    try {
      // Generar número de remisión
      const { data: remisionData } = await supabase.rpc('generate_pickup_remision')
      const remisionNumber = remisionData || `REC-${Date.now()}`

      // Recopilar canastillas seleccionadas
      const canastillasSeleccionadas: { id: string; previousOwnerId: string }[] = []
      for (const lote of lotes) {
        if (lote.cantidadRecoger > 0) {
          const selected = lote.canastillas.slice(0, lote.cantidadRecoger)
          selected.forEach(c => canastillasSeleccionadas.push({
            id: c.id,
            previousOwnerId: c.current_owner_id,
          }))
        }
      }

      if (canastillasSeleccionadas.length === 0) throw new Error('No hay canastillas seleccionadas')

      // 1. Crear registro de recogida
      const { data: pickupRecord, error: pickupErr } = await supabase
        .from('conductor_pickups')
        .insert({
          conductor_id: user.id,
          sale_point_id: selectedSalePoint.id,
          client_name: selectedSalePoint.name,
          client_address: selectedSalePoint.address || null,
          client_phone: selectedSalePoint.contact_phone || null,
          client_contact: selectedSalePoint.contact_name || null,
          items_count: canastillasSeleccionadas.length,
          remision_number: remisionNumber,
          firma_cliente_base64: signatureData?.firma_entrega_base64 || null,
          firma_cliente_nombre: signatureData?.firma_entrega_nombre || null,
          firma_cliente_cedula: signatureData?.firma_entrega_cedula || null,
          firma_conductor_base64: signatureData?.firma_recibe_base64 || null,
          firma_conductor_nombre: signatureData?.firma_recibe_nombre || null,
          firma_conductor_cedula: signatureData?.firma_recibe_cedula || null,
          auth_code: authorizationCode || null,
        })
        .select()
        .single()

      if (pickupErr) throw pickupErr

      // 2. Crear items de recogida
      const BATCH = 500
      const pickupItems = canastillasSeleccionadas.map(c => ({
        pickup_id: pickupRecord.id,
        canastilla_id: c.id,
        previous_owner_id: c.previousOwnerId,
      }))

      for (let i = 0; i < pickupItems.length; i += BATCH) {
        const batch = pickupItems.slice(i, i + BATCH)
        const { error: itemsErr } = await supabase.from('conductor_pickup_items').insert(batch)
        if (itemsErr) throw itemsErr
      }

      // 3. Actualizar canastillas: mover al conductor + marcar como recogida
      const canastillaIds = canastillasSeleccionadas.map(c => c.id)
      for (let i = 0; i < canastillaIds.length; i += BATCH) {
        const batch = canastillaIds.slice(i, i + BATCH)
        const { error: updateErr } = await supabase
          .from('canastillas')
          .update({
            current_owner_id: user.id,
            status: 'DISPONIBLE',
            is_pickup: true,
            pickup_client_name: selectedSalePoint.name,
            pickup_date: new Date().toISOString(),
          })
          .in('id', batch)
        if (updateErr) throw updateErr
      }

      // 4. Auditoría
      const metodo = authorizationCode ? 'código de autorización' : 'firma digital'
      await logAuditEvent({
        userId: user.id,
        userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        userRole: user.role,
        action: 'CREATE',
        module: 'recogidas',
        description: `Recogida de ${canastillasSeleccionadas.length} canastilla(s) del cliente ${selectedSalePoint.name}. Remisión: ${remisionNumber}. Método: ${metodo}`,
        details: {
          pickup_id: pickupRecord.id,
          sale_point_id: selectedSalePoint.id,
          client_name: selectedSalePoint.name,
          cantidad: canastillasSeleccionadas.length,
          remision: remisionNumber,
          metodo_autorizacion: authorizationCode ? 'codigo' : 'firma',
        },
      })

      // 5. Notificar al super_admin
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true)

      if (admins && admins.length > 0) {
        const notifications = admins.map(a => ({
          user_id: a.id,
          type: 'RECOGIDA_COMPLETADA',
          title: 'Recogida realizada',
          message: `${user.first_name} ${user.last_name} recogió ${canastillasSeleccionadas.length} canastilla(s) del cliente ${selectedSalePoint.name}. Remisión: ${remisionNumber}. Método: ${metodo}`,
          related_id: pickupRecord.id,
        }))
        await supabase.from('notifications').insert(notifications)
      }

      setResultModal({ show: true, type: 'success', title: 'Recogida completada', message: `${canastillasSeleccionadas.length} canastillas recogidas del cliente ${selectedSalePoint.name}.\nRemisión: ${remisionNumber}` })
    } catch (err: any) {
      console.error('Error en recogida:', err)
      setResultModal({ show: true, type: 'error', title: 'Error en recogida', message: err.message || 'Ocurrió un error' })
      setStep('canastillas')
    } finally {
      setLoading(false)
      setFirmaLoading(false)
    }
  }

  /** Callback del modal de firma digital */
  const handleFirmaConfirm = (signatureData: SignatureData) => processRecogida(signatureData)

  /** Validar código de autorización y procesar */
  const handleAuthCodeSubmit = async () => {
    if (!authCode.trim()) { setAuthError('Ingresa el código de autorización'); return }
    setValidatingCode(true)
    setAuthError('')
    try {
      const { data, error } = await supabase
        .from('pickup_auth_codes')
        .select('id, code')
        .eq('code', authCode.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle()
      if (error) throw error
      if (!data) { setAuthError('Código de autorización inválido o inactivo'); setValidatingCode(false); return }
      await processRecogida(undefined, authCode.trim().toUpperCase())
    } catch (err: any) {
      setAuthError(err.message || 'Error al validar el código')
    } finally {
      setValidatingCode(false)
    }
  }

  /** Cerrar modal resultado y finalizar */
  const handleResultClose = () => {
    setResultModal(p => ({ ...p, show: false }))
    if (resultModal.type === 'success') {
      onSuccess()
      onClose()
    }
  }

  const filteredSalePoints = salePoints.filter(sp =>
    sp.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    sp.contact_name.toLowerCase().includes(searchClient.toLowerCase()) ||
    sp.city?.toLowerCase().includes(searchClient.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-20 pb-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Nueva Recogida
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {step === 'cliente' && 'Paso 1: Seleccionar cliente'}
                  {step === 'canastillas' && 'Paso 2: Seleccionar canastillas'}
                  {step === 'metodo' && 'Paso 3: Método de autorización'}
                  {step === 'firma' && 'Paso 3: Firma del cliente'}
                  {step === 'codigo' && 'Paso 3: Código de autorización'}
                </p>
              </div>
              {/* Steps indicator */}
              <div className="flex items-center gap-1">
                {['cliente', 'canastillas', 'metodo'].map((s, i) => {
                  const currentIdx = ['cliente', 'canastillas', 'metodo', 'firma', 'codigo'].indexOf(step)
                  const stepIdx = i
                  return (
                    <div
                      key={s}
                      className={`w-8 h-1.5 rounded-full transition-colors ${
                        currentIdx === stepIdx ? 'bg-orange-500' : currentIdx > stepIdx ? 'bg-orange-300' : 'bg-gray-200'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
                <p className="text-sm text-gray-500">Procesando recogida...</p>
              </div>
            ) : step === 'cliente' ? (
              /* PASO 1: Seleccionar cliente */
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buscar cliente
                </label>
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    value={searchClient}
                    onChange={(e) => {
                      setSearchClient(e.target.value)
                      setDropdownOpen(true)
                      if (selectedSalePoint && e.target.value !== selectedSalePoint.name) {
                        setSelectedSalePoint(null)
                      }
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Escribe el nombre del cliente..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  {loadingSalePoints && (
                    <div className="absolute right-3 top-3.5">
                      <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                  {dropdownOpen && filteredSalePoints.length > 0 && (
                    <div className="w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredSalePoints.map(sp => (
                        <button
                          key={sp.id}
                          onClick={() => handleSelectClient(sp)}
                          className={`w-full text-left px-4 py-3 hover:bg-orange-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-0 ${
                            selectedSalePoint?.id === sp.id ? 'bg-orange-50 dark:bg-gray-600' : ''
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{sp.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {sp.contact_name} · {sp.address}{sp.city ? `, ${sp.city}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSalePoint && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{selectedSalePoint.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      👤 {selectedSalePoint.contact_name}
                    </p>
                    {selectedSalePoint.contact_phone && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">📞 {selectedSalePoint.contact_phone}</p>
                    )}
                    {selectedSalePoint.address && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">📍 {selectedSalePoint.address}{selectedSalePoint.city ? `, ${selectedSalePoint.city}` : ''}</p>
                    )}
                  </div>
                )}
              </div>
            ) : step === 'canastillas' ? (
              /* PASO 2: Seleccionar canastillas */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Selecciona la cantidad de canastillas a recoger de cada usuario/bodega
                  </p>
                  <span className="text-sm font-bold text-orange-600">
                    Total: {totalSeleccionadas}
                  </span>
                </div>

                {loadingLotes ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  </div>
                ) : lotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No hay canastillas disponibles para recoger</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto">
                    {lotes.map(lote => (
                      <div key={lote.key} className="border border-gray-200 dark:border-gray-600 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {lote.ownerName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {lote.size} · {lote.color} · {lote.totalDisponible} disponibles
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateLoteCantidad(lote.key, lote.cantidadRecoger - 1)}
                              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              disabled={lote.cantidadRecoger === 0}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={lote.cantidadRecoger}
                              onChange={(e) => updateLoteCantidad(lote.key, parseInt(e.target.value) || 0)}
                              className="w-16 text-center px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              min={0}
                              max={lote.totalDisponible}
                            />
                            <button
                              onClick={() => updateLoteCantidad(lote.key, lote.cantidadRecoger + 1)}
                              className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              disabled={lote.cantidadRecoger >= lote.totalDisponible}
                            >
                              +
                            </button>
                            <button
                              onClick={() => updateLoteCantidad(lote.key, lote.totalDisponible)}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium px-2"
                            >
                              Todas
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : step === 'metodo' ? (
              /* PASO 3: Elegir método de autorización */
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                  ¿Cómo deseas autorizar la recogida de <span className="font-bold text-orange-600">{totalSeleccionadas}</span> canastilla{totalSeleccionadas !== 1 ? 's' : ''}?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Opción Firma Digital */}
                  <button
                    onClick={handleSelectFirma}
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-gray-700/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">Firma Digital</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">El cliente firma en pantalla junto con el conductor</span>
                  </button>

                  {/* Opción Código de Autorización */}
                  <button
                    onClick={handleSelectCodigo}
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 bg-white dark:bg-gray-700/50 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">Código de Autorización</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Ingresa el código autorizado para retiro sin firma</span>
                  </button>
                </div>
              </div>
            ) : step === 'codigo' ? (
              /* PASO 3b: Código de autorización */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Código de Autorización</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Ingresa el código para autorizar el retiro de <span className="font-bold text-orange-600">{totalSeleccionadas}</span> canastilla{totalSeleccionadas !== 1 ? 's' : ''} de {selectedSalePoint?.name}
                  </p>
                </div>
                <div>
                  <input
                    type="password"
                    value={authCode}
                    onChange={e => { setAuthCode(e.target.value.toUpperCase()); setAuthError('') }}
                    placeholder="••••••••••"
                    className={`w-full px-4 py-3 text-center text-lg font-mono tracking-widest border rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow ${
                      authError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    onKeyDown={e => { if (e.key === 'Enter') handleAuthCodeSubmit() }}
                    autoFocus
                  />
                  {authError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {authError}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <button
              onClick={() => {
                if (step === 'cliente') onClose()
                else if (step === 'canastillas') setStep('cliente')
                else if (step === 'metodo') setStep('canastillas')
                else if (step === 'codigo') setStep('metodo')
                else if (step === 'firma') setStep('metodo')
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {step === 'cliente' ? 'Cancelar' : 'Atrás'}
            </button>
            
            {step === 'cliente' && (
              <Button
                onClick={handleContinueToCanastillas}
                disabled={!selectedSalePoint}
              >
                Continuar →
              </Button>
            )}
            {step === 'canastillas' && (
              <Button
                onClick={handleContinueToFirma}
                disabled={totalSeleccionadas === 0}
              >
                Continuar ({totalSeleccionadas}) →
              </Button>
            )}
            {step === 'codigo' && (
              <Button
                onClick={handleAuthCodeSubmit}
                disabled={!authCode.trim() || validatingCode}
              >
                {validatingCode ? 'Validando...' : 'Autorizar y Completar'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Firma Digital */}
      <FirmaDigitalModal
        isOpen={showFirmaModal}
        onClose={() => {
          setShowFirmaModal(false)
          setStep('metodo')
        }}
        onConfirm={handleFirmaConfirm}
        loading={firmaLoading}
        title={`Firma de Recogida - ${selectedSalePoint?.name || ''}`}
        entregaLabel="CLIENTE (Autoriza)"
        recibeLabel="CONDUCTOR (Recoge)"
        mode="both"
        confirmButtonText="Firmar y Completar Recogida"
      />

      {/* Modal de resultado */}
      {resultModal.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleResultClose} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              resultModal.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {resultModal.type === 'success' ? (
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{resultModal.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line">{resultModal.message}</p>
            <button
              onClick={handleResultClose}
              className={`w-full py-2.5 rounded-xl font-semibold text-white transition-colors ${
                resultModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
