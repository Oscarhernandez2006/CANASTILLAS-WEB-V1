import { useState, useEffect, useRef } from 'react'
import { Button } from './Button'
import { FirmaDigitalModal } from './FirmaDigitalModal'
import { SearchableUserSelect } from './SearchableUserSelect'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSalePoints } from '@/hooks/useSalePoints'
import { openRemisionTraspasoPDF } from '@/utils/remisionTraspasoGenerator'
import type { User, Canastilla, Transfer, SignatureData } from '@/types'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  tipo_propiedad: string
  statusGroup: 'DISPONIBLE' | 'EN_ALQUILER'
  clienteAlquiler?: string
  tipoAlquiler?: 'INTERNO' | 'EXTERNO'
  totalDisponible: number
  cantidadTraspasar: number
  canastillas: Canastilla[]
}

interface SolicitarTraspasoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SolicitarTraspasoModal({
  isOpen,
  onClose,
  onSuccess,
}: SolicitarTraspasoModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  const { user: currentUser } = useAuthStore()
  const { salePoints, loading: loadingSalePoints } = useSalePoints()

  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [canastillasRetenidas, setCanastillasRetenidas] = useState(0)
  const [tipoTraspaso, setTipoTraspaso] = useState<'normal' | 'externo'>('normal')

  const [formData, setFormData] = useState({
    to_user_id: '',
    reason: '',
    notes: '',
  })

  // Estado para traspaso externo por cliente
  const [selectedSalePointId, setSelectedSalePointId] = useState('')
  const [salePointSearch, setSalePointSearch] = useState('')
  const [salePointDropdownOpen, setSalePointDropdownOpen] = useState(false)
  const salePointDropdownRef = useRef<HTMLDivElement>(null)
  const salePointInputRef = useRef<HTMLInputElement>(null)

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (salePointDropdownRef.current && !salePointDropdownRef.current.contains(e.target as Node)) {
        setSalePointDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchUsers()
      fetchCanastillasYAgrupar()
    }
  }, [isOpen])

  const fetchCanastillasYAgrupar = async () => {
    if (!currentUser) return

    setLoadingLotes(true)
    setError('')

    try {
      // 1. Obtener IDs de canastillas que ya están en traspasos PENDIENTES del usuario actual
      const { data: traspasosPendientes, error: errorTraspasos } = await supabase
        .from('transfers')
        .select('id')
        .eq('from_user_id', currentUser.id)
        .eq('status', 'PENDIENTE')

      let canastillasRetenidasIds: string[] = []

      if (!errorTraspasos && traspasosPendientes && traspasosPendientes.length > 0) {
        const transferIds = traspasosPendientes.map(t => t.id)

        // Obtener items retenidos con batching
        const BATCH_SIZE = 500
        for (let i = 0; i < transferIds.length; i += BATCH_SIZE) {
          const batchIds = transferIds.slice(i, i + BATCH_SIZE)
          const { data: itemsRetenidos, error: errorItems } = await supabase
            .from('transfer_items')
            .select('canastilla_id')
            .in('transfer_id', batchIds)

          if (!errorItems && itemsRetenidos) {
            canastillasRetenidasIds = [...canastillasRetenidasIds, ...itemsRetenidos.map(item => item.canastilla_id)]
          }
        }
      }

      // 2. Obtener canastillas disponibles y en alquiler con paginación
      const PAGE_SIZE = 1000
      let disponibles: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: errorDisponibles } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', currentUser.id)
          .in('status', ['DISPONIBLE', 'EN_ALQUILER'])
          .order('color', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (errorDisponibles) throw errorDisponibles

        if (data && data.length > 0) {
          disponibles = [...disponibles, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // 3. Filtrar canastillas retenidas
      const canastillasLibres = disponibles.filter(
        c => !canastillasRetenidasIds.includes(c.id)
      )

      // Guardar cantidad de retenidas para mostrar mensaje
      const cantidadRetenidas = disponibles.length - canastillasLibres.length
      setCanastillasRetenidas(cantidadRetenidas)

      // 3.5 Para canastillas EN_ALQUILER, obtener info del alquiler y cliente
      const enAlquilerIds = canastillasLibres
        .filter(c => c.status === 'EN_ALQUILER')
        .map(c => c.id)

      // Mapa: canastilla_id → { clienteName, rentalType }
      const rentalInfoMap: Record<string, { clienteName: string; rentalType: 'INTERNO' | 'EXTERNO' }> = {}

      if (enAlquilerIds.length > 0) {
        const BATCH_RENTAL = 500
        for (let i = 0; i < enAlquilerIds.length; i += BATCH_RENTAL) {
          const batchIds = enAlquilerIds.slice(i, i + BATCH_RENTAL)
          const { data: rentalItems } = await supabase
            .from('rental_items')
            .select(`
              canastilla_id,
              rental:rentals!inner(
                id,
                rental_type,
                status,
                sale_point:sale_points(name)
              )
            `)
            .in('canastilla_id', batchIds)
            .eq('rentals.status', 'ACTIVO')

          if (rentalItems) {
            for (const item of rentalItems) {
              const rental = item.rental as any
              if (rental) {
                rentalInfoMap[item.canastilla_id] = {
                  clienteName: rental.sale_point?.name || 'Cliente desconocido',
                  rentalType: rental.rental_type || 'INTERNO',
                }
              }
            }
          }
        }

        // Intentar también con PENDIENTE_FIRMA para canastillas que aún no se confirmaron
        const sinInfo = enAlquilerIds.filter(id => !rentalInfoMap[id])
        if (sinInfo.length > 0) {
          for (let i = 0; i < sinInfo.length; i += BATCH_RENTAL) {
            const batchIds = sinInfo.slice(i, i + BATCH_RENTAL)
            const { data: rentalItems } = await supabase
              .from('rental_items')
              .select(`
                canastilla_id,
                rental:rentals!inner(
                  id,
                  rental_type,
                  status,
                  sale_point:sale_points(name)
                )
              `)
              .in('canastilla_id', batchIds)
              .eq('rentals.status', 'PENDIENTE_FIRMA')

            if (rentalItems) {
              for (const item of rentalItems) {
                const rental = item.rental as any
                if (rental && !rentalInfoMap[item.canastilla_id]) {
                  rentalInfoMap[item.canastilla_id] = {
                    clienteName: rental.sale_point?.name || 'Cliente desconocido',
                    rentalType: rental.rental_type || 'INTERNO',
                  }
                }
              }
            }
          }
        }
      }

      // 4. Agrupar por size + color + shape + tipo_propiedad + status + cliente
      const grouped: Record<string, LoteGroup> = {}

      for (const canastilla of canastillasLibres) {
        const statusGroup = canastilla.status === 'EN_ALQUILER' ? 'EN_ALQUILER' : 'DISPONIBLE'
        const rentalInfo = rentalInfoMap[canastilla.id]
        const clienteKey = statusGroup === 'EN_ALQUILER' ? (rentalInfo?.clienteName || 'Sin cliente') : ''
        const key = `${canastilla.size}-${canastilla.color}-${canastilla.shape || ''}-${canastilla.tipo_propiedad || 'PROPIA'}-${statusGroup}-${clienteKey}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: canastilla.size,
            color: canastilla.color,
            shape: canastilla.shape || '',
            tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
            statusGroup: statusGroup as 'DISPONIBLE' | 'EN_ALQUILER',
            clienteAlquiler: statusGroup === 'EN_ALQUILER' ? clienteKey : undefined,
            tipoAlquiler: statusGroup === 'EN_ALQUILER' ? rentalInfo?.rentalType : undefined,
            totalDisponible: 0,
            cantidadTraspasar: 0,
            canastillas: []
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(canastilla)
      }

      // Ordenar: primero DISPONIBLE, luego EN_ALQUILER
      const sortedLotes = Object.values(grouped).sort((a, b) => {
        if (a.statusGroup === b.statusGroup) return 0
        return a.statusGroup === 'DISPONIBLE' ? -1 : 1
      })

      setLotes(sortedLotes)
    } catch (err: any) {
      console.error('Error fetching canastillas:', err)
      setError('Error al cargar las canastillas: ' + err.message)
    } finally {
      setLoadingLotes(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .neq('id', currentUser?.id || '')
        .order('first_name')

      if (error) throw error

      setUsers(data || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      setError('Error al cargar usuarios')
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadTraspasar: Math.min(Math.max(0, cantidad), lote.totalDisponible) }
          : lote
      )
    )
  }

  const handleTraspasarTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadTraspasar: lote.totalDisponible }
          : lote
      )
    )
  }

  const handleTraspasarTodoGlobal = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadTraspasar: lote.totalDisponible }))
    )
  }

  const handleLimpiarTodo = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadTraspasar: 0 }))
    )
  }

  // Calcular totales
  const totalCanastillasTraspasar = lotes.reduce((sum, lote) => sum + lote.cantidadTraspasar, 0)
  const totalCanastillasDisponibles = lotes.reduce((sum, lote) => sum + lote.totalDisponible, 0)

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentUser) { setError('Usuario no autenticado'); return }
    if (tipoTraspaso === 'normal' && !formData.to_user_id) { setError('Selecciona un usuario destino'); return }
    if (tipoTraspaso === 'externo') {
      if (!selectedSalePointId) { setError('Selecciona un cliente o punto de venta'); return }
    }
    if (totalCanastillasTraspasar === 0) { setError('Selecciona al menos una canastilla'); return }

    // Validación OK → abrir modal de firma
    setShowFirmaModal(true)
  }

  const handleFirmaConfirm = async (signatureData: SignatureData) => {
    setShowFirmaModal(false)
    setError('')
    setLoading(true)

    try {
      if (!currentUser) throw new Error('Usuario no autenticado')

      // Recopilar los IDs de las canastillas seleccionadas de cada lote
      const canastillaIds: string[] = []
      for (const lote of lotes) {
        if (lote.cantidadTraspasar > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadTraspasar)
          canastillaIds.push(...seleccionadas.map(c => c.id))
        }
      }

      const now = new Date().toISOString()
      let targetUserId = formData.to_user_id
      const isExternalTransfer = tipoTraspaso === 'externo'
      const selectedClient = isExternalTransfer ? salePoints.find(sp => sp.id === selectedSalePointId) : null

      // Para traspasos externos, buscar o crear usuario cliente inactivo
      if (isExternalTransfer) {
        if (!selectedClient) throw new Error('Cliente no encontrado')
        const { data: externalUserId, error: userError } = await supabase
          .rpc('get_or_create_external_user', {
            p_cedula: selectedClient.identification || selectedClient.code,
            p_nombre: selectedClient.contact_name || selectedClient.name,
            p_empresa: selectedClient.name || null,
          })

        if (userError) throw new Error('Error al crear destinatario externo: ' + userError.message)
        targetUserId = externalUserId
      }

      // Verificar si el usuario destino es personal de lavado
      const selectedUser = !isExternalTransfer ? users.find(u => u.id === targetUserId) : null
      const isWashingTransfer = selectedUser?.role === 'washing_staff'

      // 1. Generar número de remisión (RL para lavado, RT para traspaso normal)
      const remisionFunction = isWashingTransfer
        ? 'generate_washing_remision_number'
        : 'generate_transfer_remision_number'

      const { data: remisionData, error: remisionError } = await supabase
        .rpc(remisionFunction)

      if (remisionError) throw remisionError
      const remisionNumber = remisionData as string

      // 2. Crear el traspaso con número de remisión + firma del remitente
      const { data: transfer, error: transferError } = await supabase
        .from('transfers')
        .insert([{
          from_user_id: currentUser.id,
          to_user_id: targetUserId,
          status: isExternalTransfer ? 'ACEPTADO' : 'PENDIENTE',
          reason: isWashingTransfer ? 'Envío a lavado' : (isExternalTransfer ? `Traspaso externo a ${selectedClient?.name || 'Cliente'}` : formData.reason),
          notes: formData.notes,
          remision_number: remisionNumber,
          remision_generated_at: now,
          is_washing_transfer: isWashingTransfer,
          is_external_transfer: isExternalTransfer,
          external_recipient_name: isExternalTransfer ? (selectedClient?.contact_name || selectedClient?.name) : null,
          external_recipient_cedula: isExternalTransfer ? (selectedClient?.identification || selectedClient?.code) : null,
          external_recipient_phone: isExternalTransfer ? selectedClient?.contact_phone : null,
          external_recipient_empresa: isExternalTransfer ? selectedClient?.name : null,
          sale_point_id: isExternalTransfer ? selectedSalePointId : null,
          responded_at: isExternalTransfer ? now : null,
          firma_entrega_base64: signatureData.firma_entrega_base64,
          firma_entrega_nombre: signatureData.firma_entrega_nombre,
          firma_entrega_cedula: signatureData.firma_entrega_cedula,
          firma_recibe_base64: isExternalTransfer ? signatureData.firma_recibe_base64 : null,
          firma_recibe_nombre: isExternalTransfer ? signatureData.firma_recibe_nombre : null,
          firma_recibe_cedula: isExternalTransfer ? signatureData.firma_recibe_cedula : null,
          firma_tercero_base64: signatureData.firma_tercero_base64 || null,
          firma_tercero_nombre: signatureData.firma_tercero_nombre || null,
          firma_tercero_cedula: signatureData.firma_tercero_cedula || null,
        }])
        .select()
        .single()

      if (transferError) throw transferError

      // 3. Insertar las canastillas del traspaso (en lotes de 500 para evitar límite)
      const transferItems = canastillaIds.map(canastillaId => ({
        transfer_id: transfer.id,
        canastilla_id: canastillaId,
      }))

      const BATCH_SIZE = 500
      for (let i = 0; i < transferItems.length; i += BATCH_SIZE) {
        const batch = transferItems.slice(i, i + BATCH_SIZE)
        const { error: itemsError } = await supabase
          .from('transfer_items')
          .insert(batch)

        if (itemsError) throw itemsError
      }

      // 4. Crear notificación (solo para traspasos normales/lavado, no externos)
      if (!isExternalTransfer) {
        const notifTitle = isWashingTransfer
          ? 'Canastillas enviadas a lavado'
          : 'Nueva solicitud de traspaso'
        const notifMessage = isWashingTransfer
          ? `${currentUser.first_name} ${currentUser.last_name} te ha enviado ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''} para lavado.`
          : `${currentUser.first_name} ${currentUser.last_name} te ha enviado una solicitud de traspaso de ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''}.`

        await supabase
          .from('notifications')
          .insert([{
            user_id: targetUserId,
            type: isWashingTransfer ? 'LAVADO_RECIBIDO' : 'TRASPASO_RECIBIDO',
            title: notifTitle,
            message: notifMessage,
            related_id: transfer.id
          }])
      }

      // Para traspasos externos, mover canastillas inmediatamente (ya que se auto-aceptan)
      if (isExternalTransfer) {
        // Separar canastillas por status para mantener EN_ALQUILER
        const canastillasEnAlquiler: string[] = []
        const canastillasOtras: string[] = []

        for (const lote of lotes) {
          if (lote.cantidadTraspasar > 0) {
            const seleccionadas = lote.canastillas.slice(0, lote.cantidadTraspasar)
            for (const c of seleccionadas) {
              if (c.status === 'EN_ALQUILER') {
                canastillasEnAlquiler.push(c.id)
              } else {
                canastillasOtras.push(c.id)
              }
            }
          }
        }

        const BATCH_UPDATE = 500

        // Canastillas normales → EN_USO_INTERNO
        for (let i = 0; i < canastillasOtras.length; i += BATCH_UPDATE) {
          const batch = canastillasOtras.slice(i, i + BATCH_UPDATE)
          const { error: updateError } = await supabase
            .from('canastillas')
            .update({
              current_owner_id: targetUserId,
              status: 'EN_USO_INTERNO',
            })
            .in('id', batch)

          if (updateError) throw updateError
        }

        // Canastillas EN_ALQUILER → mantener status
        for (let i = 0; i < canastillasEnAlquiler.length; i += BATCH_UPDATE) {
          const batch = canastillasEnAlquiler.slice(i, i + BATCH_UPDATE)
          const { error: updateError } = await supabase
            .from('canastillas')
            .update({
              current_owner_id: targetUserId,
            })
            .in('id', batch)

          if (updateError) throw updateError
        }

        // Guardar conteo de items pendientes
        await supabase
          .from('transfers')
          .update({ pending_items_count: canastillaIds.length, returned_items_count: 0 })
          .eq('id', transfer.id)
      }

      // 5. Obtener datos completos para generar el PDF de remisión
      const { data: transferBase, error: transferBaseError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(*),
          to_user:users!transfers_to_user_id_fkey(*)
        `)
        .eq('id', transfer.id)
        .single()

      if (transferBaseError) throw transferBaseError

      // Luego obtener TODOS los transfer_items con paginación
      const PAGE_SIZE_ITEMS = 1000
      let allTransferItems: any[] = []
      let hasMoreItems = true
      let offsetItems = 0

      while (hasMoreItems) {
        const { data: itemsBatch, error: itemsError } = await supabase
          .from('transfer_items')
          .select('*, canastilla:canastillas(*)')
          .eq('transfer_id', transfer.id)
          .range(offsetItems, offsetItems + PAGE_SIZE_ITEMS - 1)

        if (itemsError) throw itemsError

        if (itemsBatch && itemsBatch.length > 0) {
          allTransferItems = [...allTransferItems, ...itemsBatch]
          offsetItems += PAGE_SIZE_ITEMS
          hasMoreItems = itemsBatch.length === PAGE_SIZE_ITEMS
        } else {
          hasMoreItems = false
        }
      }

      // Combinar transfer con todos sus items
      const fullTransfer = {
        ...transferBase,
        transfer_items: allTransferItems
      }

      // 6. Abrir la remisión PDF con firma del remitente
      await openRemisionTraspasoPDF(fullTransfer as unknown as Transfer, signatureData)

      const successMessage = isExternalTransfer
        ? `Traspaso externo registrado exitosamente.\n\nCliente: ${selectedClient?.name || ''}\nRemisión: ${remisionNumber}\nCanastillas: ${canastillaIds.length}`
        : isWashingTransfer
        ? `Canastillas enviadas a lavado exitosamente.\n\nRemisión de Lavado: ${remisionNumber}`
        : `Solicitud de traspaso creada exitosamente.\n\nRemisión: ${remisionNumber}`
      alert(successMessage)
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || 'Error al crear el traspaso')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ to_user_id: '', reason: '', notes: '' })
    setSelectedSalePointId('')
    setSalePointSearch('')
    setSalePointDropdownOpen(false)
    setTipoTraspaso('normal')
    setLotes([])
    setError('')
    setCanastillasRetenidas(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay de procesamiento */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-primary-200 rounded-full"></div>
              <div className="w-14 h-14 border-4 border-primary-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
            </div>
            <p className="text-gray-800 font-semibold text-lg text-center">Creando traspaso...</p>
            <p className="text-gray-500 text-sm text-center">Por favor espera, no cierres esta página</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <form onSubmit={handlePreSubmit}>
            <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  Solicitar Traspaso
                </h3>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-white hover:text-gray-200 p-1"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-h-[65vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Mensaje de canastillas retenidas */}
              {canastillasRetenidas > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-700 px-4 py-3 rounded-r-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm">
                      <strong>{canastillasRetenidas}</strong> canastilla{canastillasRetenidas !== 1 ? 's' : ''} no disponible{canastillasRetenidas !== 1 ? 's' : ''} porque ya está{canastillasRetenidas !== 1 ? 'n' : ''} en solicitudes de traspaso pendientes.
                    </p>
                  </div>
                </div>
              )}

              {/* Selector de tipo de traspaso */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Traspaso
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTipoTraspaso('normal'); setFormData({ ...formData, to_user_id: '' }) }}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      tipoTraspaso === 'normal'
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Normal
                    </div>
                    <p className="text-xs mt-1 opacity-75">Usuario del sistema</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTipoTraspaso('externo'); setFormData({ ...formData, to_user_id: '' }) }}
                    className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      tipoTraspaso === 'externo'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Externo
                    </div>
                    <p className="text-xs mt-1 opacity-75">Destinatario externo</p>
                  </button>
                </div>
              </div>

              {/* Formulario para destinatario externo - Selector de Cliente */}
              {tipoTraspaso === 'externo' && (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                    <h4 className="text-sm font-medium text-orange-800 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Clientes o Puntos de Venta
                    </h4>
                    {loadingSalePoints ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Cargando clientes...</span>
                      </div>
                    ) : (
                      <>
                        <div className="relative" ref={salePointDropdownRef}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Cliente / Punto de Venta *</label>
                          {selectedSalePointId && !salePointDropdownOpen ? (
                            (() => {
                              const sel = salePoints.find(sp => sp.id === selectedSalePointId)
                              if (!sel) return null
                              return (
                                <div
                                  className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-orange-400 transition-colors"
                                  onClick={() => {
                                    setSalePointDropdownOpen(true)
                                    setTimeout(() => salePointInputRef.current?.focus(), 0)
                                  }}
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-sm font-semibold text-orange-700">
                                        {sel.name?.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {sel.name}
                                        <span className="ml-1 text-xs text-gray-400">
                                          {sel.client_type === 'CLIENTE_EXTERNO' ? '(Externo)' : '(Punto de Venta)'}
                                        </span>
                                      </p>
                                      <p className="text-xs text-gray-500 truncate">{sel.contact_name} {sel.identification ? `· ${sel.identification}` : ''}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedSalePointId('')
                                      setSalePointSearch('')
                                      setSalePointDropdownOpen(false)
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 flex-shrink-0 ml-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              )
                            })()
                          ) : (
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                              <input
                                ref={salePointInputRef}
                                type="text"
                                value={salePointSearch}
                                onChange={(e) => {
                                  setSalePointSearch(e.target.value)
                                  setSalePointDropdownOpen(true)
                                }}
                                onFocus={() => setSalePointDropdownOpen(true)}
                                placeholder="Buscar por nombre, contacto, NIT..."
                                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                          )}

                          {salePointDropdownOpen && (
                            <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {(() => {
                                const searchLower = salePointSearch.toLowerCase()
                                const filtered = salePoints.filter(sp => sp.is_active && (
                                  !salePointSearch ||
                                  sp.name.toLowerCase().includes(searchLower) ||
                                  (sp.contact_name && sp.contact_name.toLowerCase().includes(searchLower)) ||
                                  (sp.identification && sp.identification.toLowerCase().includes(searchLower)) ||
                                  (sp.code && sp.code.toLowerCase().includes(searchLower))
                                ))
                                const externos = filtered.filter(sp => sp.client_type === 'CLIENTE_EXTERNO')
                                const puntos = filtered.filter(sp => sp.client_type === 'PUNTO_VENTA')

                                if (filtered.length === 0) {
                                  return <li className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron resultados</li>
                                }

                                return (
                                  <>
                                    {externos.length > 0 && (
                                      <>
                                        <li className="px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 sticky top-0">Clientes Externos</li>
                                        {externos.map(sp => (
                                          <li
                                            key={sp.id}
                                            onClick={() => {
                                              setSelectedSalePointId(sp.id)
                                              setSalePointSearch('')
                                              setSalePointDropdownOpen(false)
                                            }}
                                            className="px-4 py-2 cursor-pointer hover:bg-orange-50 transition-colors"
                                          >
                                            <p className="text-sm font-medium text-gray-900">{sp.name}</p>
                                            <p className="text-xs text-gray-500">{sp.contact_name} {sp.identification ? `· ${sp.identification}` : ''}</p>
                                          </li>
                                        ))}
                                      </>
                                    )}
                                    {puntos.length > 0 && (
                                      <>
                                        <li className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 sticky top-0">Puntos de Venta</li>
                                        {puntos.map(sp => (
                                          <li
                                            key={sp.id}
                                            onClick={() => {
                                              setSelectedSalePointId(sp.id)
                                              setSalePointSearch('')
                                              setSalePointDropdownOpen(false)
                                            }}
                                            className="px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
                                          >
                                            <p className="text-sm font-medium text-gray-900">{sp.name}</p>
                                            <p className="text-xs text-gray-500">{sp.contact_name}</p>
                                          </li>
                                        ))}
                                      </>
                                    )}
                                  </>
                                )
                              })()}
                            </ul>
                          )}
                        </div>
                        {/* Mostrar info del cliente seleccionado */}
                        {selectedSalePointId && (() => {
                          const client = salePoints.find(sp => sp.id === selectedSalePointId)
                          if (!client) return null
                          return (
                            <div className="p-3 bg-white rounded-lg border border-orange-100 text-sm space-y-1">
                              <p className="font-medium text-gray-900">{client.name}</p>
                              <p className="text-gray-600">Contacto: {client.contact_name} · {client.contact_phone}</p>
                              {client.address && <p className="text-gray-500">{client.address}, {client.city}</p>}
                              {client.identification && <p className="text-gray-500">NIT/CC: {client.identification}</p>}
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>

                  <p className="text-xs text-orange-600">
                    El traspaso externo se acepta automáticamente. Se requerirá firma del conductor y del cliente.
                  </p>
                </div>
              )}

              {/* Selector de usuario destino (solo para traspaso normal) */}
              {tipoTraspaso === 'normal' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transferir a *
                </label>
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                    <span className="ml-2 text-sm text-gray-600">Cargando usuarios...</span>
                  </div>
                ) : (
                  <>
                    <SearchableUserSelect
                      users={users || []}
                      value={formData.to_user_id}
                      onChange={(userId) => setFormData({ ...formData, to_user_id: userId })}
                      placeholder="Buscar por nombre, email..."
                      required
                      renderBadge={(user) =>
                        user.role === 'washing_staff'
                          ? <span className="ml-1 text-xs text-cyan-600 font-medium"> 🧼 [LAVADO]</span>
                          : null
                      }
                    />

                    {/* Aviso cuando se selecciona personal de lavado */}
                    {formData.to_user_id && users.find(u => u.id === formData.to_user_id)?.role === 'washing_staff' && (
                      <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <div className="flex items-center text-cyan-800">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-medium">
                            Envío a Lavado: Las canastillas cambiarán a estado "EN_LAVADO" al aprobar.
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

              {/* Selector de cantidades por lote */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Canastillas a Traspasar por Lote
                  </h4>
                  {!loadingLotes && lotes.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTraspasarTodoGlobal}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        Seleccionar todas
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={handleLimpiarTodo}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Limpiar
                      </button>
                    </div>
                  )}
                </div>

                {loadingLotes ? (
                  <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Cargando canastillas...</p>
                    </div>
                  </div>
                ) : lotes.length === 0 ? (
                  <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-500">No tienes canastillas disponibles o en alquiler para traspasar</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header de la tabla */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                      <div className="col-span-5">Lote</div>
                      <div className="col-span-2 text-center">Disponibles</div>
                      <div className="col-span-3 text-center">Traspasar</div>
                      <div className="col-span-2 text-center">Acción</div>
                    </div>

                    {/* Filas de lotes */}
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
                              {lote.statusGroup === 'EN_ALQUILER' && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    lote.tipoAlquiler === 'EXTERNO'
                                      ? 'bg-pink-100 text-pink-700'
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    Alq. {lote.tipoAlquiler === 'EXTERNO' ? 'Externo' : 'Interno'}
                                  </span>
                                  {lote.clienteAlquiler && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 max-w-[140px] truncate" title={lote.clienteAlquiler}>
                                      📋 {lote.clienteAlquiler}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm font-semibold text-gray-700">
                              {lote.totalDisponible}
                            </span>
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              max={lote.totalDisponible}
                              value={lote.cantidadTraspasar || ''}
                              onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleTraspasarTodo(lote.key)}
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
                      <div className="col-span-5 text-sm font-semibold text-gray-900">
                        TOTAL
                      </div>
                      <div className="col-span-2 text-center text-sm font-semibold text-gray-700">
                        {totalCanastillasDisponibles}
                      </div>
                      <div className="col-span-3 text-center text-sm font-bold text-primary-600">
                        {totalCanastillasTraspasar}
                      </div>
                      <div className="col-span-2"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mostrar campo de razón solo si NO es personal de lavado y NO es externo */}
              {tipoTraspaso === 'normal' && !(formData.to_user_id && users.find(u => u.id === formData.to_user_id)?.role === 'washing_staff') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Razón del Traspaso
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Ej: Canastillas limpias para despacho"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas Adicionales
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas opcionales..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Resumen de selección */}
              {totalCanastillasTraspasar > 0 && (
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm font-medium text-primary-800">
                    Se traspasarán <strong>{totalCanastillasTraspasar}</strong> canastilla{totalCanastillasTraspasar !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto text-sm order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading || loadingLotes || totalCanastillasTraspasar === 0 || (tipoTraspaso === 'normal' && !formData.to_user_id) || (tipoTraspaso === 'externo' && !selectedSalePointId)}
                className="w-full sm:w-auto text-sm order-1 sm:order-2"
              >
                {loading ? 'Enviando...' : `Enviar (${totalCanastillasTraspasar})`}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmación de Usuario de Retorno */}
      {/* Modal de Firma Digital - Entrega only */}
      <FirmaDigitalModal
        isOpen={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        onConfirm={handleFirmaConfirm}
        loading={loading}
        title={tipoTraspaso === 'externo' ? 'Firmas de Remisión de Entrega' : 'Firma de Entrega'}
        entregaLabel="ENTREGA"
        recibeLabel="RECIBE"
        mode={tipoTraspaso === 'externo' ? 'both' : 'entrega-only'}
        confirmButtonText={tipoTraspaso === 'externo' ? 'Firmar y Registrar' : 'Firmar y Enviar'}
        allowTercero
      />
    </div>
  )
}
