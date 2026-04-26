/**
 * @module TraspasosPage
 * @description Módulo de traspasos: solicitar, aceptar/rechazar, historial, firma digital.
 */
import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { FirmaDigitalModal } from '@/components/FirmaDigitalModal'
import { SolicitarTraspasoModal } from '@/components/SolicitarTraspasoModal'
import { DevolucionTraspasoModal } from '@/components/DevolucionTraspasoModal'
import { AsignarRecogidaModal } from '@/components/AsignarRecogidaModal'
import { RecogidaConductorModal } from '@/components/RecogidaConductorModal'
import { useTraspasos } from '@/hooks/useTraspasos'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/utils/helpers'
import { openRemisionTraspasoPDF, getRemisionTraspasoPDFBlob } from '@/utils/remisionTraspasoGenerator'
import { uploadSignedPDF } from '@/services/storageService'
import { logAuditEvent } from '@/services/auditService'
import type { Transfer, SignatureData } from '@/types'

type TabType = 'solicitudes-recibidas' | 'solicitudes-enviadas' | 'devoluciones-externas' | 'historial'

export function TraspasosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('solicitudes-recibidas')
  const [showSolicitarModal, setShowSolicitarModal] = useState(false)
  const [showFirmaApprovalModal, setShowFirmaApprovalModal] = useState(false)
  const [selectedTransferForApproval, setSelectedTransferForApproval] = useState<any>(null)
  const [firmaLoading, setFirmaLoading] = useState(false)
  const [showDevolucionModal, setShowDevolucionModal] = useState(false)
  const [selectedTransferForReturn, setSelectedTransferForReturn] = useState<Transfer | null>(null)
  const [showAsignarRecogidaModal, setShowAsignarRecogidaModal] = useState(false)
  const [selectedTransferForPickup, setSelectedTransferForPickup] = useState<Transfer | null>(null)
  const [showRecogidaConductorModal, setShowRecogidaConductorModal] = useState(false)
  const [historialRecogidas, setHistorialRecogidas] = useState<any[]>([])
  const [loadingRecogidas, setLoadingRecogidas] = useState(false)
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)
  const [showMotivoModal, setShowMotivoModal] = useState(false)
  const [motivoAccion, setMotivoAccion] = useState<'rechazar' | 'cancelar'>('rechazar')
  const [motivoTransferId, setMotivoTransferId] = useState<string>('')
  const [motivoSeleccionado, setMotivoSeleccionado] = useState<string>('')

  const MOTIVOS_RECHAZO = [
    'Usuario seleccionado incorrecto',
    'Cantidad de canastillas incorrecta',
    'Error en la digitación de datos',
    'Canastillas no corresponden al envío',
    'Duplicado de solicitud',
    'Solicitud no autorizada',
    'Cambio de destino requerido',
    'Canastillas en mal estado',
  ]

  const MOTIVOS_CANCELACION = [
    'Error al seleccionar el destinatario',
    'Cantidad de canastillas incorrecta',
    'Error en la digitación de datos',
    'Duplicado de solicitud',
    'Ya no se requiere el traspaso',
    'Cambio de destino requerido',
    'Canastillas no disponibles',
    'Solicitud creada por error',
  ]

  // Timer para actualizar el tiempo restante cada 30 segundos
  const [, setTimerTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTimerTick(t => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const EXPIRATION_MINUTES = 420

  /** Calcula tiempo restante antes de la auto-aceptación */
  const getTimeRemaining = useCallback((requestedAt: string): { minutes: number; autoAccepted: boolean; label: string } => {
    const requested = new Date(requestedAt).getTime()
    const expiresAt = requested + EXPIRATION_MINUTES * 60 * 1000
    const remaining = expiresAt - Date.now()
    const minutes = Math.max(0, Math.ceil(remaining / 60000))
    const autoAccepted = remaining <= 0

    if (autoAccepted) return { minutes: 0, autoAccepted: true, label: 'Aceptado automático' }
    if (minutes <= 30) return { minutes, autoAccepted: false, label: `${minutes} min para auto-aceptación` }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return { minutes, autoAccepted: false, label: `Auto-aceptación en ${hours}h ${mins}m` }
  }, [])

  const { user } = useAuthStore()
  const {
    solicitudesRecibidas,
    solicitudesEnviadas,
    historial,
    devolucionesExternas,
    pickupsPendientes,
    loading,
    refreshTraspasos
  } = useTraspasos()

  // Si el usuario no es super_admin ni conductor, resetear tab si quedó en devoluciones-externas
  useEffect(() => {
    if (activeTab === 'devoluciones-externas' && user?.role !== 'super_admin' && user?.role !== 'conductor') {
      setActiveTab('solicitudes-recibidas')
    }
    if (activeTab === 'devoluciones-externas') {
      fetchHistorialRecogidas()
    }
  }, [activeTab, user?.role])

  const fetchHistorialRecogidas = async () => {
    setLoadingRecogidas(true)
    try {
      let query = supabase
        .from('conductor_pickups')
        .select(`
          id,
          conductor_id,
          client_name,
          client_address,
          items_count,
          remision_number,
          created_at,
          conductor:users!conductor_pickups_conductor_id_fkey(first_name, last_name),
          sale_point:sale_points(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      // Conductores solo ven sus propias recogidas
      if (user?.role === 'conductor') {
        query = query.eq('conductor_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setHistorialRecogidas(data || [])
    } catch (err) {
      console.error('Error fetching historial recogidas:', err)
    } finally {
      setLoadingRecogidas(false)
    }
  }

  const showFourthTab = user?.role === 'super_admin' || user?.role === 'conductor'

  const handleFirmarYAceptar = async (id: string) => {
    // Verificar auto-aceptación antes de abrir el modal de firma
    const solicitud = solicitudesRecibidas.find(s => s.id === id)
    if (solicitud) {
      const timeInfo = getTimeRemaining(solicitud.requested_at)
      if (timeInfo.autoAccepted) {
        alert('Esta solicitud ya fue aceptada automáticamente. Las canastillas ya viajaron al destinatario. Actualiza la página.')
        refreshTraspasos()
        return
      }
    }

    setProcessingMessage('Cargando datos del traspaso...')
    try {
      // Obtener datos del transfer incluyendo firma del remitente
      const { data: transferData, error: fetchError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(*),
          to_user:users!transfers_to_user_id_fkey(*)
        `)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      setProcessingMessage(null)
      setSelectedTransferForApproval(transferData)
      setShowFirmaApprovalModal(true)
    } catch (error: any) {
      setProcessingMessage(null)
      alert('Error al cargar el traspaso: ' + error.message)
    }
  }

  const handleFirmaApprovalConfirm = async (signatureData: SignatureData) => {
    setShowFirmaApprovalModal(false)
    setFirmaLoading(true)
    setProcessingMessage('Procesando traspaso...')

    try {
      const transfer = selectedTransferForApproval
      if (!transfer) throw new Error('No se encontró el traspaso')

      const isWashingTransfer = transfer.is_washing_transfer || false
      const newLocation = transfer.to_user?.department || null
      const newArea = transfer.to_user?.area || null

      // ============================================================
      // TRANSACCIÓN ATÓMICA: Validar + Mover canastillas + Aceptar
      // Todo ocurre en una sola transacción de base de datos.
      // Si algo falla, se hace rollback automático.
      // ============================================================
      setProcessingMessage('Validando y moviendo canastillas (transacción atómica)...')
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_transfer_atomic', {
        p_transfer_id: transfer.id,
        p_user_id: user!.id,
        p_firma_recibe_base64: signatureData.firma_recibe_base64 || null,
        p_firma_recibe_nombre: signatureData.firma_recibe_nombre || null,
        p_firma_recibe_cedula: signatureData.firma_recibe_cedula || null,
        p_firma_tercero_base64: signatureData.firma_tercero_base64 || null,
        p_firma_tercero_nombre: signatureData.firma_tercero_nombre || null,
        p_firma_tercero_cedula: signatureData.firma_tercero_cedula || null,
        p_is_washing_transfer: isWashingTransfer,
        p_new_location: newLocation,
        p_new_area: newArea,
      })

      if (rpcError) throw rpcError

      if (!rpcResult || !rpcResult.success) {
        const errorMsg = rpcResult?.error || 'Error desconocido al procesar el traspaso'
        throw new Error(errorMsg)
      }

      const totalMoved = rpcResult.total_moved || 0

      // Obtener transfer_items para el PDF (lectura, no modifica nada)
      setProcessingMessage('Generando remisión firmada...')
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

      // Combinar firmas para el PDF final
      const fullSignatureData: SignatureData = {
        firma_entrega_base64: transfer.firma_entrega_base64 || '',
        firma_entrega_nombre: transfer.firma_entrega_nombre || '',
        firma_entrega_cedula: transfer.firma_entrega_cedula || '',
        firma_recibe_base64: signatureData.firma_recibe_base64,
        firma_recibe_nombre: signatureData.firma_recibe_nombre,
        firma_recibe_cedula: signatureData.firma_recibe_cedula,
        firma_tercero_base64: signatureData.firma_tercero_base64 || transfer.firma_tercero_base64 || undefined,
        firma_tercero_nombre: signatureData.firma_tercero_nombre || transfer.firma_tercero_nombre || undefined,
        firma_tercero_cedula: signatureData.firma_tercero_cedula || transfer.firma_tercero_cedula || undefined,
      }

      const fullTransfer = {
        ...transfer,
        transfer_items: allTransferItems
      } as unknown as Transfer

      // Generar PDF con ambas firmas y subir a storage
      try {
        const pdfBlob = await getRemisionTraspasoPDFBlob(fullTransfer, fullSignatureData)
        const pdfUrl = await uploadSignedPDF(
          pdfBlob,
          'transfers',
          `Remision_${transfer.remision_number}.pdf`
        )

        if (pdfUrl) {
          await supabase
            .from('transfers')
            .update({ signed_pdf_url: pdfUrl })
            .eq('id', transfer.id)
        }
      } catch (pdfErr) {
        console.error('Error al subir PDF firmado:', pdfErr)
      }

      // Abrir PDF con ambas firmas
      await openRemisionTraspasoPDF(fullTransfer, fullSignatureData)

      // Notificar al remitente que su traspaso fue aceptado
      try {
        const receiverName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        await supabase
          .from('notifications')
          .insert([{
            user_id: transfer.from_user_id,
            type: isWashingTransfer ? 'LAVADO_ACEPTADO' : 'TRASPASO_ACEPTADO',
            title: isWashingTransfer ? 'Lavado aceptado' : 'Traspaso aceptado',
            message: `${receiverName} ha aceptado tu ${isWashingTransfer ? 'envío de lavado' : 'solicitud de traspaso'} de ${totalMoved} canastilla${totalMoved !== 1 ? 's' : ''}. Remisión: ${transfer.remision_number || 'N/A'}`,
            related_id: transfer.id
          }])
      } catch (notifErr) {
        console.error('Error al enviar notificación:', notifErr)
      }

      const successMessage = isWashingTransfer
        ? 'Canastillas recibidas para lavado. Remisión: ' + (transfer.remision_number || '')
        : 'Traspaso aceptado exitosamente. Remisión: ' + (transfer.remision_number || '')
      alert(successMessage)

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'UPDATE',
        module: 'traspasos',
        description: `Traspaso aceptado (transacción atómica) - ${totalMoved} canastilla(s). Remisión: ${transfer.remision_number || 'N/A'}`,
        details: { transfer_id: transfer.id, remision: transfer.remision_number, cantidad: totalMoved, tipo: isWashingTransfer ? 'lavado' : 'normal' },
      })

      setSelectedTransferForApproval(null)
      refreshTraspasos()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setFirmaLoading(false)
      setProcessingMessage(null)
    }
  }

  const handleVerRemision = async (transfer: any) => {
    try {
      // Si hay PDF firmado en storage, abrir directamente
      if (transfer.signed_pdf_url) {
        window.open(transfer.signed_pdf_url, '_blank')
        return
      }

      // Obtener el transfer base sin items (para evitar límite de 1000)
      const { data: transferBase } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(*),
          to_user:users!transfers_to_user_id_fkey(*)
        `)
        .eq('id', transfer.id)
        .single()

      if (transferBase) {
        // Obtener TODOS los transfer_items con paginación
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

        // Construir signatureData con las firmas que existan en DB
        const signatureData: SignatureData = {
          firma_entrega_base64: transferBase.firma_entrega_base64 || '',
          firma_entrega_nombre: transferBase.firma_entrega_nombre || '',
          firma_entrega_cedula: transferBase.firma_entrega_cedula || '',
          firma_recibe_base64: transferBase.firma_recibe_base64 || '',
          firma_recibe_nombre: transferBase.firma_recibe_nombre || '',
          firma_recibe_cedula: transferBase.firma_recibe_cedula || '',
          firma_tercero_base64: transferBase.firma_tercero_base64 || undefined,
          firma_tercero_nombre: transferBase.firma_tercero_nombre || undefined,
          firma_tercero_cedula: transferBase.firma_tercero_cedula || undefined,
        }

        await openRemisionTraspasoPDF(fullTransfer as unknown as Transfer, signatureData)
      }
    } catch (error: any) {
      alert('Error al generar la remisión: ' + error.message)
    }
  }

  const handleRechazar = async (id: string) => {
    setMotivoAccion('rechazar')
    setMotivoTransferId(id)
    setMotivoSeleccionado('')
    setShowMotivoModal(true)
  }

  const handleCompletarRecogida = async (pickup: any) => {
    if (!confirm(`¿Confirmar que recogiste las ${pickup.items_count} canastilla(s) del cliente ${pickup.transfer?.external_recipient_name || 'externo'}?`)) return

    setProcessingMessage('Procesando recogida...')
    try {
      // Obtener items del pickup
      const { data: pickupItems, error: itemsErr } = await supabase
        .from('pickup_assignment_items')
        .select('canastilla_id, transfer_item_id')
        .eq('pickup_assignment_id', pickup.id)

      if (itemsErr) throw itemsErr
      if (!pickupItems || pickupItems.length === 0) throw new Error('No se encontraron canastillas')

      const canastillaIds = pickupItems.map((i: any) => i.canastilla_id)

      // Crear transfer_return para trazabilidad
      const { data: returnRecord, error: returnErr } = await supabase
        .from('transfer_returns')
        .insert({
          transfer_id: pickup.transfer_id,
          processed_by: user!.id,
          notes: `Recogida completada por conductor. Pickup #${pickup.id.slice(0, 8)}`
        })
        .select()
        .single()

      if (returnErr) throw returnErr

      // Crear transfer_return_items
      const returnItems = canastillaIds.map((cId: string) => ({
        transfer_return_id: returnRecord.id,
        canastilla_id: cId
      }))

      const BATCH = 500
      for (let i = 0; i < returnItems.length; i += BATCH) {
        const { error: riErr } = await supabase.from('transfer_return_items').insert(returnItems.slice(i, i + BATCH))
        if (riErr) throw riErr
      }

      // Actualizar canastillas: owner = conductor, status = DISPONIBLE
      for (let i = 0; i < canastillaIds.length; i += BATCH) {
        const batch = canastillaIds.slice(i, i + BATCH)
        const { error: updateErr } = await supabase
          .from('canastillas')
          .update({ current_owner_id: user!.id, status: 'DISPONIBLE' })
          .in('id', batch)
        if (updateErr) throw updateErr
      }

      // Actualizar contadores del transfer
      const { data: transferData } = await supabase
        .from('transfers')
        .select('returned_items_count, pending_items_count')
        .eq('id', pickup.transfer_id)
        .single()

      const currentReturned = transferData?.returned_items_count || 0
      const newReturned = currentReturned + canastillaIds.length
      const currentPending = transferData?.pending_items_count ?? 0
      const newPending = Math.max(0, currentPending - canastillaIds.length)

      await supabase
        .from('transfers')
        .update({
          returned_items_count: newReturned,
          pending_items_count: newPending
        })
        .eq('id', pickup.transfer_id)

      // Marcar pickup como completada
      await supabase
        .from('pickup_assignments')
        .update({ status: 'COMPLETADA', completed_at: new Date().toISOString() })
        .eq('id', pickup.id)

      // Notificar al super_admin que asignó
      await supabase.from('notifications').insert([{
        user_id: pickup.assigned_by,
        type: 'RECOGIDA_COMPLETADA',
        title: 'Recogida completada',
        message: `${user?.first_name} ${user?.last_name} completó la recogida de ${canastillaIds.length} canastilla(s) del cliente ${pickup.transfer?.external_recipient_name || 'externo'}.`,
        related_id: pickup.id,
      }])

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'UPDATE',
        module: 'recogidas',
        description: `Recogida completada. ${canastillaIds.length} canastilla(s) del cliente ${pickup.transfer?.external_recipient_name || 'externo'}.`,
        details: { pickup_id: pickup.id, transfer_id: pickup.transfer_id, cantidad: canastillaIds.length },
      })

      alert(`✅ Recogida completada. ${canastillaIds.length} canastillas agregadas a tu inventario.`)
      refreshTraspasos()
    } catch (err: any) {
      alert('❌ Error: ' + err.message)
    } finally {
      setProcessingMessage(null)
    }
  }

  const handleConfirmarRechazo = async () => {
    if (!motivoSeleccionado) {
      alert('Debes seleccionar un motivo')
      return
    }
    setShowMotivoModal(false)
    const id = motivoTransferId
    const motivo = motivoSeleccionado
    setProcessingMessage('Rechazando traspaso...')

    try {
      const { data: transferData } = await supabase
        .from('transfers')
        .select('from_user_id, items_count, remision_number, is_washing_transfer')
        .eq('id', id)
        .single()

      const { data: updateResult, error } = await supabase
        .from('transfers')
        .update({ 
          status: 'RECHAZADO',
          rejection_reason: motivo,
          responded_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('status', 'PENDIENTE')
        .select('id')

      if (error) throw error

      if (!updateResult || updateResult.length === 0) {
        alert('Este traspaso ya fue procesado por otro usuario. Actualizando lista...')
        refreshTraspasos()
        return
      }

      if (transferData) {
        const receiverName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        await supabase
          .from('notifications')
          .insert([{
            user_id: transferData.from_user_id,
            type: 'TRASPASO_RECHAZADO',
            title: 'Traspaso rechazado',
            message: `${receiverName} ha rechazado tu solicitud de traspaso${transferData.remision_number ? '. Remisión: ' + transferData.remision_number : ''}. Motivo: ${motivo}`,
            related_id: id
          }])
      }

      alert('✅ Traspaso rechazado')

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'UPDATE',
        module: 'traspasos',
        description: `Traspaso rechazado. Remisión: ${transferData?.remision_number || 'N/A'}. Motivo: ${motivo}`,
        details: { transfer_id: id, remision: transferData?.remision_number, motivo },
      })

      refreshTraspasos()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setProcessingMessage(null)
    }
  }

  const handleCancelar = async (id: string) => {
    setMotivoAccion('cancelar')
    setMotivoTransferId(id)
    setMotivoSeleccionado('')
    setShowMotivoModal(true)
  }

  const handleConfirmarCancelacion = async () => {
    if (!motivoSeleccionado) {
      alert('Debes seleccionar un motivo')
      return
    }
    setShowMotivoModal(false)
    const id = motivoTransferId
    const motivo = motivoSeleccionado
    setProcessingMessage('Cancelando solicitud...')

    try {
      const { data: transferData } = await supabase
        .from('transfers')
        .select('to_user_id, items_count, remision_number')
        .eq('id', id)
        .single()

      const { data: updateResult, error } = await supabase
        .from('transfers')
        .update({
          status: 'CANCELADO',
          rejection_reason: motivo,
          responded_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('status', 'PENDIENTE')
        .select('id')

      if (error) throw error

      if (!updateResult || updateResult.length === 0) {
        alert('Este traspaso ya fue procesado por otro usuario (aceptado o rechazado). Actualizando lista...')
        refreshTraspasos()
        return
      }

      if (transferData) {
        const senderName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        await supabase
          .from('notifications')
          .insert([{
            user_id: transferData.to_user_id,
            type: 'TRASPASO_CANCELADO',
            title: 'Traspaso cancelado',
            message: `${senderName} ha cancelado su solicitud de traspaso${transferData.remision_number ? '. Remisión: ' + transferData.remision_number : ''}. Motivo: ${motivo}`,
            related_id: id
          }])
      }

      alert('✅ Solicitud cancelada exitosamente')

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'UPDATE',
        module: 'traspasos',
        description: `Traspaso cancelado. Remisión: ${transferData?.remision_number || 'N/A'}. Motivo: ${motivo}`,
        details: { transfer_id: id, remision: transferData?.remision_number, motivo },
      })

      refreshTraspasos()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setProcessingMessage(null)
    }
  }

  const getStatusBadge = (status: string, transfer?: any) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDIENTE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
      ACEPTADO: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aceptado' },
      RECHAZADO: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' },
      CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelado' },
      EXPIRADA: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Expirada' },
      ACEPTADO_AUTO: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Aceptado Automático' },
    }

    // Para traspasos externos aceptados, mostrar estado de devolución
    if ((status === 'ACEPTADO' || status === 'ACEPTADO_AUTO') && transfer?.is_external_transfer) {
      const returned = transfer.returned_items_count || 0
      const pending = transfer.pending_items_count ?? (transfer.items_count || 0)

      if (pending <= 0 && returned > 0) {
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            Devuelto Total
          </span>
        )
      }
      if (returned > 0 && pending > 0) {
        return (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
            Devuelto Parcial ({returned}/{returned + pending})
          </span>
        )
      }
      return (
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
          Externo - Pendiente
        </span>
      )
    }

    const badge = badges[status] || badges.PENDIENTE

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <DashboardLayout 
      title="Traspasos" 
      subtitle="Gestión de movimientos de canastillas entre usuarios"
    >
      {/* Overlay de procesamiento */}
      {processingMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-primary-200 rounded-full"></div>
              <div className="w-14 h-14 border-4 border-primary-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
            </div>
            <p className="text-gray-800 font-semibold text-lg text-center">{processingMessage}</p>
            <p className="text-gray-500 text-sm text-center">Por favor espera, no cierres esta página</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Botón Solicitar Traspaso */}
        <div className="flex justify-end">
          <Button onClick={() => setShowSolicitarModal(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Solicitar Traspaso
          </Button>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-2">
          <div className={`grid grid-cols-2 ${showFourthTab ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-1 sm:gap-2`}>
            <button
              onClick={() => setActiveTab('solicitudes-recibidas')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 relative ${
                activeTab === 'solicitudes-recibidas'
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="hidden sm:inline">📥 </span>Recibidas
              {(solicitudesRecibidas || []).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs">
                  {solicitudesRecibidas.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('solicitudes-enviadas')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'solicitudes-enviadas'
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="hidden sm:inline">📤 </span>Enviadas
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === 'historial'
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="hidden sm:inline">📋 </span>Historial
            </button>
            {(user?.role === 'super_admin' || user?.role === 'conductor') && (
              <button
                onClick={() => setActiveTab('devoluciones-externas')}
                className={`px-2 sm:px-4 py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 relative ${
                  activeTab === 'devoluciones-externas'
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-500/25'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="hidden sm:inline">📦 </span>Recogidas
              </button>
            )}
          </div>
        </div>

        {/* Tab: Solicitudes Recibidas */}
        {activeTab === 'solicitudes-recibidas' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesRecibidas || []).length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">No hay solicitudes recibidas</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Aquí aparecerán las solicitudes de traspaso que te envíen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">De</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Canastillas</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-3 sm:px-6 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(solicitudesRecibidas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {solicitud.from_user?.first_name} {solicitud.from_user?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {solicitud.from_user?.email}
                          </div>
                          {solicitud.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {solicitud.remision_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {solicitud.items_count ?? (solicitud.transfer_items || []).length} canastillas
                          </div>
                          {(solicitud as any).en_alquiler_count > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                {(solicitud as any).en_alquiler_count} en alquiler
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDateTime(solicitud.requested_at)}
                          </div>
                          {solicitud.status === 'PENDIENTE' && (() => {
                            const timeInfo = getTimeRemaining(solicitud.requested_at)
                            return (
                              <div className={`text-xs mt-1 font-medium ${
                                timeInfo.autoAccepted ? 'text-blue-600' : 
                                timeInfo.minutes <= 30 ? 'text-orange-600' : 
                                'text-gray-500'
                              }`}>
                                {timeInfo.autoAccepted ? '✅ Aceptado automático' : `⏱ ${timeInfo.label}`}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(solicitud.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            {solicitud.remision_number && (
                              <button
                                onClick={() => handleVerRemision(solicitud)}
                                className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Remisión
                              </button>
                            )}
                            {solicitud.status === 'PENDIENTE' && (
                              <>
                                <button
                                  onClick={() => handleFirmarYAceptar(solicitud.id)}
                                  className="inline-flex items-center text-green-600 hover:text-green-900 font-medium text-sm"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  Firmar y Aceptar
                                </button>
                                <button
                                  onClick={() => handleRechazar(solicitud.id)}
                                  className="text-red-600 hover:text-red-900 font-medium text-sm"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Solicitudes Enviadas */}
        {activeTab === 'solicitudes-enviadas' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesEnviadas || []).length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">No has enviado solicitudes</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Selecciona canastillas y haz clic en "Solicitar Traspaso"
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Para</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Canastillas</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(solicitudesEnviadas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {solicitud.to_user?.first_name} {solicitud.to_user?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {solicitud.to_user?.email}
                          </div>
                          {solicitud.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {solicitud.remision_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {solicitud.items_count ?? (solicitud.transfer_items || []).length} canastillas
                          </div>
                          {(solicitud as any).en_alquiler_count > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                {(solicitud as any).en_alquiler_count} en alquiler
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDateTime(solicitud.requested_at)}
                          </div>
                          {solicitud.status === 'PENDIENTE' && (() => {
                            const timeInfo = getTimeRemaining(solicitud.requested_at)
                            return (
                              <div className={`text-xs mt-1 font-medium ${
                                timeInfo.autoAccepted ? 'text-blue-600' : 
                                timeInfo.minutes <= 30 ? 'text-orange-600' : 
                                'text-gray-500'
                              }`}>
                                {timeInfo.autoAccepted ? '✅ Aceptado automático' : `⏱ ${timeInfo.label}`}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(solicitud.status)}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-right">
                          <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
                            {solicitud.remision_number && (
                              <button
                                onClick={() => handleVerRemision(solicitud)}
                                className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Remisión
                              </button>
                            )}
                            {solicitud.status === 'PENDIENTE' && (
                              <button
                                onClick={() => handleCancelar(solicitud.id)}
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Historial */}
        {activeTab === 'historial' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (historial || []).length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Sin historial</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Aquí aparecerán los traspasos completados o rechazados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">De → Para</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Canastillas</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {(historial || []).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {item.from_user?.first_name} {item.from_user?.last_name}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 mx-2">→</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {item.to_user?.first_name} {item.to_user?.last_name}
                            </span>
                          </div>
                          {item.remision_number && (
                            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                              {item.remision_number}
                              {item.is_external_transfer && (
                                <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px]">
                                  EXTERNO
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {item.items_count ?? (item.transfer_items || []).length} canastillas
                          </div>
                          {(item as any).en_alquiler_count > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                {(item as any).en_alquiler_count} en alquiler
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDateTime(item.responded_at || item.requested_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status, item)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {(item.status === 'ACEPTADO' || item.status === 'ACEPTADO_AUTO') && item.remision_number && (
                              <button
                                onClick={() => handleVerRemision(item)}
                                className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Ver Remisión
                              </button>
                            )}
                            {item.status === 'ACEPTADO' && item.is_external_transfer && (item.pending_items_count ?? (item.items_count || 0)) > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedTransferForReturn(item as unknown as Transfer)
                                  setShowDevolucionModal(true)
                                }}
                                className="inline-flex items-center text-orange-600 hover:text-orange-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Registrar Devolución
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Devoluciones / Recogidas (super_admin y conductor) */}
        {activeTab === 'devoluciones-externas' && (user?.role === 'super_admin' || user?.role === 'conductor') && (
          <div className="space-y-4">
            {/* Botón Nueva Recogida */}
            <div className="flex justify-end">
              <Button onClick={() => setShowRecogidaConductorModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Nueva Recogida
              </Button>
            </div>

            {/* Historial de Recogidas */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de Recogidas</h3>
              </div>
              {loadingRecogidas ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                </div>
              ) : historialRecogidas.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No hay recogidas registradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Conductor</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Remisión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {historialRecogidas.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {formatDateTime(rec.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {rec.conductor?.first_name} {rec.conductor?.last_name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {rec.sale_point?.name || rec.client_name}
                            </div>
                            {rec.client_address && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{rec.client_address}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                              {rec.items_count}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {rec.remision_number ? (
                              <span className="text-sm font-mono font-medium text-purple-600 dark:text-purple-400">
                                {rec.remision_number}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal Solicitar Traspaso */}
      <SolicitarTraspasoModal
        isOpen={showSolicitarModal}
        onClose={() => setShowSolicitarModal(false)}
        onSuccess={() => refreshTraspasos()}
      />

      {/* Modal de Firma Digital - Receptor firma para aceptar */}
      <FirmaDigitalModal
        isOpen={showFirmaApprovalModal}
        onClose={() => {
          setShowFirmaApprovalModal(false)
          setSelectedTransferForApproval(null)
        }}
        onConfirm={handleFirmaApprovalConfirm}
        loading={firmaLoading}
        title="Firmar y Aceptar Traspaso"
        entregaLabel="ENTREGA"
        recibeLabel="RECIBE"
        mode="recibe-only"
        prefillEntrega={selectedTransferForApproval ? {
          nombre: selectedTransferForApproval.firma_entrega_nombre || `${selectedTransferForApproval.from_user?.first_name || ''} ${selectedTransferForApproval.from_user?.last_name || ''}`,
          cedula: selectedTransferForApproval.firma_entrega_cedula || '',
          firma_base64: selectedTransferForApproval.firma_entrega_base64 || '',
        } : undefined}
        confirmButtonText="Firmar y Aceptar"
        allowTercero
        prefillTercero={selectedTransferForApproval?.firma_tercero_base64 ? {
          nombre: selectedTransferForApproval.firma_tercero_nombre || '',
          cedula: selectedTransferForApproval.firma_tercero_cedula || '',
          firma_base64: selectedTransferForApproval.firma_tercero_base64,
        } : undefined}
      />

      {/* Modal Devolución de Traspaso Externo */}
      <DevolucionTraspasoModal
        isOpen={showDevolucionModal}
        onClose={() => {
          setShowDevolucionModal(false)
          setSelectedTransferForReturn(null)
        }}
        onSuccess={() => refreshTraspasos()}
        transfer={selectedTransferForReturn}
      />

      {/* Modal Asignar Recogida a Conductor */}
      <AsignarRecogidaModal
        isOpen={showAsignarRecogidaModal}
        onClose={() => {
          setShowAsignarRecogidaModal(false)
          setSelectedTransferForPickup(null)
        }}
        onSuccess={() => refreshTraspasos()}
        transfer={selectedTransferForPickup}
      />

      {/* Modal Recogida Conductor (nuevo sistema) */}
      <RecogidaConductorModal
        isOpen={showRecogidaConductorModal}
        onClose={() => setShowRecogidaConductorModal(false)}
        onSuccess={() => { refreshTraspasos(); fetchHistorialRecogidas() }}
      />

      {/* Modal Motivo de Rechazo/Cancelación */}
      {showMotivoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowMotivoModal(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {motivoAccion === 'rechazar' ? 'Rechazar Traspaso' : 'Cancelar Traspaso'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Selecciona el motivo:
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(motivoAccion === 'rechazar' ? MOTIVOS_RECHAZO : MOTIVOS_CANCELACION).map((motivo) => (
                  <label
                    key={motivo}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      motivoSeleccionado === motivo
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={motivo}
                      checked={motivoSeleccionado === motivo}
                      onChange={() => setMotivoSeleccionado(motivo)}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{motivo}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-5">
                <Button variant="outline" onClick={() => setShowMotivoModal(false)}>
                  Volver
                </Button>
                <Button
                  variant={motivoAccion === 'rechazar' ? 'danger' : 'danger'}
                  onClick={motivoAccion === 'rechazar' ? handleConfirmarRechazo : handleConfirmarCancelacion}
                  disabled={!motivoSeleccionado}
                >
                  {motivoAccion === 'rechazar' ? 'Rechazar' : 'Cancelar traspaso'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}