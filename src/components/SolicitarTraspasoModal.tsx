import { useState, useEffect } from 'react'
import { Button } from './Button'
import { FirmaDigitalModal } from './FirmaDigitalModal'
import { SearchableUserSelect } from './SearchableUserSelect'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { openRemisionTraspasoPDF } from '@/utils/remisionTraspasoGenerator'
import type { User, Canastilla, Transfer, SignatureData } from '@/types'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  tipo_propiedad: string
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

  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [canastillasRetenidas, setCanastillasRetenidas] = useState(0)
  const [tipoTraspaso, setTipoTraspaso] = useState<'normal' | 'externo'>('normal')

  const [formData, setFormData] = useState({
    to_user_id: '',
    reason: '',
    notes: '',
  })

  const [externalData, setExternalData] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    empresa: '',
  })

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

      // 2. Obtener canastillas disponibles con paginación
      const PAGE_SIZE = 1000
      let disponibles: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: errorDisponibles } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', currentUser.id)
          .eq('status', 'DISPONIBLE')
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

      // 4. Agrupar por size + color + shape + tipo_propiedad
      const grouped: Record<string, LoteGroup> = {}

      for (const canastilla of canastillasLibres) {
        const key = `${canastilla.size}-${canastilla.color}-${canastilla.shape || ''}-${canastilla.tipo_propiedad || 'PROPIA'}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: canastilla.size,
            color: canastilla.color,
            shape: canastilla.shape || '',
            tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
            totalDisponible: 0,
            cantidadTraspasar: 0,
            canastillas: []
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(canastilla)
      }

      setLotes(Object.values(grouped))
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
      if (!externalData.nombre.trim()) { setError('Ingresa el nombre del destinatario externo'); return }
      if (!externalData.cedula.trim()) { setError('Ingresa la cédula del destinatario externo'); return }
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

      // Para traspasos externos, crear usuario cliente inactivo
      if (isExternalTransfer) {
        // Buscar si ya existe un usuario con esa cédula
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', externalData.cedula)
          .eq('role', 'client')
          .maybeSingle()

        if (existingUser) {
          targetUserId = existingUser.id
        } else {
          // Crear usuario externo inactivo
          const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
              email: `externo_${externalData.cedula}@canastilla.local`,
              first_name: externalData.nombre,
              last_name: externalData.empresa || 'Externo',
              phone: externalData.cedula,
              role: 'client',
              is_active: false,
              department: externalData.empresa || null,
            })
            .select()
            .single()

          if (userError) throw new Error('Error al crear destinatario externo: ' + userError.message)
          targetUserId = newUser.id
        }
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
          reason: isWashingTransfer ? 'Envío a lavado' : (isExternalTransfer ? `Traspaso externo a ${externalData.nombre}` : formData.reason),
          notes: formData.notes,
          remision_number: remisionNumber,
          remision_generated_at: now,
          is_washing_transfer: isWashingTransfer,
          is_external_transfer: isExternalTransfer,
          external_recipient_name: isExternalTransfer ? externalData.nombre : null,
          external_recipient_cedula: isExternalTransfer ? externalData.cedula : null,
          external_recipient_phone: isExternalTransfer ? externalData.telefono : null,
          external_recipient_empresa: isExternalTransfer ? externalData.empresa : null,
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
        const BATCH_UPDATE = 500
        for (let i = 0; i < canastillaIds.length; i += BATCH_UPDATE) {
          const batch = canastillaIds.slice(i, i + BATCH_UPDATE)
          const { error: updateError } = await supabase
            .from('canastillas')
            .update({
              current_owner_id: targetUserId,
              status: 'EN_USO_INTERNO',
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
        ? `Traspaso externo registrado exitosamente.\n\nDestinatario: ${externalData.nombre}\nRemisión: ${remisionNumber}\nCanastillas: ${canastillaIds.length}`
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
    setExternalData({ nombre: '', cedula: '', telefono: '', empresa: '' })
    setTipoTraspaso('normal')
    setLotes([])
    setError('')
    setCanastillasRetenidas(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
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

              {/* Formulario para destinatario externo */}
              {tipoTraspaso === 'externo' && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-orange-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Datos del Destinatario Externo
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                      <input
                        type="text"
                        value={externalData.nombre}
                        onChange={(e) => setExternalData({ ...externalData, nombre: e.target.value })}
                        placeholder="Nombre del destinatario"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cédula / NIT *</label>
                      <input
                        type="text"
                        value={externalData.cedula}
                        onChange={(e) => setExternalData({ ...externalData, cedula: e.target.value })}
                        placeholder="Número de identificación"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={externalData.telefono}
                        onChange={(e) => setExternalData({ ...externalData, telefono: e.target.value })}
                        placeholder="Teléfono de contacto"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Empresa</label>
                      <input
                        type="text"
                        value={externalData.empresa}
                        onChange={(e) => setExternalData({ ...externalData, empresa: e.target.value })}
                        placeholder="Nombre de la empresa"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-orange-600">
                    El traspaso externo se acepta automáticamente. Podrás registrar la devolución desde el historial.
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
                    <p className="text-sm text-gray-500">No tienes canastillas disponibles para traspasar</p>
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
                disabled={loading || loadingLotes || totalCanastillasTraspasar === 0 || (tipoTraspaso === 'normal' && !formData.to_user_id) || (tipoTraspaso === 'externo' && (!externalData.nombre.trim() || !externalData.cedula.trim()))}
                className="w-full sm:w-auto text-sm order-1 sm:order-2"
              >
                {loading ? 'Enviando...' : `Enviar (${totalCanastillasTraspasar})`}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Firma Digital - Entrega only */}
      <FirmaDigitalModal
        isOpen={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        onConfirm={handleFirmaConfirm}
        loading={loading}
        title={tipoTraspaso === 'externo' ? 'Firmas de Entrega y Recepción' : 'Firma de Entrega'}
        entregaLabel="ENTREGA"
        recibeLabel="RECIBE"
        mode={tipoTraspaso === 'externo' ? 'both' : 'entrega-only'}
        confirmButtonText={tipoTraspaso === 'externo' ? 'Firmar y Registrar' : 'Firmar y Enviar'}
        allowTercero
      />
    </div>
  )
}
