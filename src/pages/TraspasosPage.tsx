/**
 * @module TraspasosPage
 * @description Módulo de traspasos: solicitar, aceptar/rechazar, historial, firma digital.
 */
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { FirmaDigitalModal } from '@/components/FirmaDigitalModal'
import { SolicitarTraspasoModal } from '@/components/SolicitarTraspasoModal'
import { DevolucionTraspasoModal } from '@/components/DevolucionTraspasoModal'
import { AsignarRecogidaModal } from '@/components/AsignarRecogidaModal'
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
  }, [activeTab, user?.role])

  const showFourthTab = user?.role === 'super_admin' || user?.role === 'conductor'

  const handleFirmarYAceptar = async (id: string) => {
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

      const now = new Date().toISOString()
      const isWashingTransfer = transfer.is_washing_transfer || false

      // 0. Verificar que el traspaso siga en estado PENDIENTE (protección contra race condition)
      const { data: currentTransfer, error: checkError } = await supabase
        .from('transfers')
        .select('status')
        .eq('id', transfer.id)
        .single()

      if (checkError) throw checkError

      if (currentTransfer.status !== 'PENDIENTE') {
        const statusLabels: Record<string, string> = { ACEPTADO: 'aceptado', RECHAZADO: 'rechazado', CANCELADO: 'cancelado' }
        throw new Error(`Este traspaso ya fue ${statusLabels[currentTransfer.status] || currentTransfer.status.toLowerCase()} por otro usuario. Por favor actualiza la página.`)
      }

      // 1. Actualizar estado a ACEPTADO + guardar firma del receptor
      const updateData: Record<string, any> = {
          status: 'ACEPTADO',
          responded_at: now,
          firma_recibe_base64: signatureData.firma_recibe_base64,
          firma_recibe_nombre: signatureData.firma_recibe_nombre,
          firma_recibe_cedula: signatureData.firma_recibe_cedula,
        }

      // Agregar firma de tercero si existe (puede venir nueva o ya estar en el transfer)
      if (signatureData.firma_tercero_base64) {
        updateData.firma_tercero_base64 = signatureData.firma_tercero_base64
        updateData.firma_tercero_nombre = signatureData.firma_tercero_nombre
        updateData.firma_tercero_cedula = signatureData.firma_tercero_cedula
      }

      const { data: updateResult, error } = await supabase
        .from('transfers')
        .update(updateData)
        .eq('id', transfer.id)
        .eq('status', 'PENDIENTE')
        .select('id')

      if (error) throw error

      if (!updateResult || updateResult.length === 0) {
        throw new Error('No se pudo aceptar el traspaso porque su estado cambió. Otro usuario ya lo procesó. Por favor actualiza la página.')
      }

      // 2. Obtener todos los transfer_items con paginación
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

      const canastillaIds = allTransferItems.map((item: any) => item.canastilla_id)

      // 3. Mover canastillas al nuevo dueño
      // Las canastillas EN_ALQUILER mantienen su status (cadena de custodia)
      setProcessingMessage(`Moviendo ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''}...`)
      const newLocation = transfer.to_user?.department || null
      const newArea = transfer.to_user?.area || null

      // Separar canastillas por status actual para manejarlas correctamente
      const enAlquilerIds = allTransferItems
        .filter((item: any) => item.canastilla?.status === 'EN_ALQUILER')
        .map((item: any) => item.canastilla_id)
      const otrasIds = canastillaIds.filter((id: string) => !enAlquilerIds.includes(id))

      const newStatus = isWashingTransfer ? 'EN_LAVADO' : 'DISPONIBLE'

      // Actualizar canastillas normales (cambian a DISPONIBLE o EN_LAVADO)
      const BATCH_SIZE = 500
      for (let i = 0; i < otrasIds.length; i += BATCH_SIZE) {
        const batch = otrasIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({
            current_owner_id: transfer.to_user_id,
            status: newStatus,
            current_location: newLocation,
            current_area: newArea
          })
          .in('id', batch)

        if (updateError) throw updateError
      }

      // Actualizar canastillas EN_ALQUILER (solo cambiar dueño, mantener EN_ALQUILER)
      for (let i = 0; i < enAlquilerIds.length; i += BATCH_SIZE) {
        const batch = enAlquilerIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({
            current_owner_id: transfer.to_user_id,
            current_location: newLocation,
            current_area: newArea
          })
          .in('id', batch)

        if (updateError) throw updateError
      }

      // 4. Combinar ambas firmas para el PDF final
      setProcessingMessage('Generando remisión firmada...')
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

      // 5. Generar PDF con ambas firmas y subir a storage
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

      // 6. Abrir PDF con ambas firmas
      await openRemisionTraspasoPDF(fullTransfer, fullSignatureData)

      // 7. Notificar al remitente que su traspaso fue aceptado
      try {
        const receiverName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        await supabase
          .from('notifications')
          .insert([{
            user_id: transfer.from_user_id,
            type: isWashingTransfer ? 'LAVADO_ACEPTADO' : 'TRASPASO_ACEPTADO',
            title: isWashingTransfer ? 'Lavado aceptado' : 'Traspaso aceptado',
            message: `${receiverName} ha aceptado tu ${isWashingTransfer ? 'envío de lavado' : 'solicitud de traspaso'} de ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''}. Remisión: ${transfer.remision_number || 'N/A'}`,
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
        description: `Traspaso aceptado - ${canastillaIds.length} canastilla(s). Remisión: ${transfer.remision_number || 'N/A'}`,
        details: { transfer_id: transfer.id, remision: transfer.remision_number, cantidad: canastillaIds.length, tipo: isWashingTransfer ? 'lavado' : 'normal' },
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
    }

    // Para traspasos externos aceptados, mostrar estado de devolución
    if (status === 'ACEPTADO' && transfer?.is_external_transfer) {
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          <div className={`grid grid-cols-2 ${showFourthTab ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-1 sm:gap-2`}>
            <button
              onClick={() => setActiveTab('solicitudes-recibidas')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
                activeTab === 'solicitudes-recibidas'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
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
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'solicitudes-enviadas'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">📤 </span>Enviadas
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'historial'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">📋 </span>Historial
            </button>
            {user?.role === 'super_admin' && (
              <button
                onClick={() => setActiveTab('devoluciones-externas')}
                className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
                  activeTab === 'devoluciones-externas'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="hidden sm:inline">🔄 </span>Devoluciones
                {(devolucionesExternas || []).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs">
                    {devolucionesExternas.length}
                  </span>
                )}
              </button>
            )}
            {user?.role === 'conductor' && (
              <button
                onClick={() => setActiveTab('devoluciones-externas')}
                className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
                  activeTab === 'devoluciones-externas'
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="hidden sm:inline">📦 </span>Recogidas
                {(pickupsPendientes || []).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs">
                    {pickupsPendientes.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab: Solicitudes Recibidas */}
        {activeTab === 'solicitudes-recibidas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesRecibidas || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No hay solicitudes recibidas</p>
                <p className="text-sm text-gray-500 mt-1">Aquí aparecerán las solicitudes de traspaso que te envíen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">De</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(solicitudesRecibidas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesEnviadas || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No has enviado solicitudes</p>
                <p className="text-sm text-gray-500 mt-1">
                  Selecciona canastillas y haz clic en "Solicitar Traspaso"
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Para</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(solicitudesEnviadas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (historial || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">Sin historial</p>
                <p className="text-sm text-gray-500 mt-1">
                  Aquí aparecerán los traspasos completados o rechazados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">De → Para</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(historial || []).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">
                              {item.from_user?.first_name} {item.from_user?.last_name}
                            </span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="font-medium text-gray-900">
                              {item.to_user?.first_name} {item.to_user?.last_name}
                            </span>
                          </div>
                          {item.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
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
                            {item.status === 'ACEPTADO' && item.remision_number && (
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

        {/* Tab: Devoluciones Externas Pendientes (super_admin) */}
        {activeTab === 'devoluciones-externas' && user?.role === 'super_admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              </div>
            ) : (devolucionesExternas || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">Sin devoluciones pendientes</p>
                <p className="text-sm text-gray-500 mt-1">
                  No hay canastillas entregadas a externos pendientes de recoger
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="p-4 bg-orange-50 border-b border-orange-200">
                  <p className="text-sm text-orange-800">
                    <strong>Devoluciones pendientes:</strong> Estas son entregas a clientes externos que aún tienen canastillas por devolver. Solo el super administrador puede asignar la devolución a un conductor.
                  </p>
                </div>
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente Externo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entregado por</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(devolucionesExternas || []).map((item) => {
                      const returned = item.returned_items_count || 0
                      const total = item.items_count || 0
                      const pending = item.pending_items_count ?? total
                      const progress = total > 0 ? Math.round((returned / total) * 100) : 0

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {(item as any).sale_point?.name || item.external_recipient_name || 'Sin nombre'}
                            </div>
                            {(item as any).sale_point ? (
                              <>
                                <div className="text-xs text-gray-500">
                                  {(item as any).sale_point.contact_name}
                                  {(item as any).sale_point.identification && ` · ${(item as any).sale_point.identification}`}
                                </div>
                              </>
                            ) : (
                              <>
                                {item.external_recipient_cedula && (
                                  <div className="text-xs text-gray-500">
                                    CC: {item.external_recipient_cedula}
                                  </div>
                                )}
                                {item.external_recipient_empresa && (
                                  <div className="text-xs text-gray-500">
                                    {item.external_recipient_empresa}
                                  </div>
                                )}
                              </>
                            )}
                            {item.remision_number && (
                              <div className="text-xs text-purple-600 font-medium mt-1">
                                {item.remision_number}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {item.from_user?.first_name} {item.from_user?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.from_user?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {total} total
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className="bg-orange-500 h-2 rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {returned}/{total}
                              </span>
                            </div>
                            <div className="text-xs text-orange-600 font-medium mt-0.5">
                              {pending} por recoger
                            </div>
                            {(item as any).en_alquiler_count > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 mt-1">
                                {(item as any).en_alquiler_count} en alquiler
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {formatDateTime(item.responded_at || item.requested_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              {item.remision_number && (
                                <button
                                  onClick={() => handleVerRemision(item)}
                                  className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Remisión
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTransferForPickup(item as unknown as Transfer)
                                  setShowAsignarRecogidaModal(true)
                                }}
                                className="inline-flex items-center text-orange-600 hover:text-orange-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Asignar Recogida
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Recogidas Pendientes (conductor) */}
        {activeTab === 'devoluciones-externas' && user?.role === 'conductor' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              </div>
            ) : (pickupsPendientes || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">Sin recogidas pendientes</p>
                <p className="text-sm text-gray-500 mt-1">
                  No tienes recogidas asignadas en este momento
                </p>
              </div>
            ) : (
              <div>
                <div className="p-4 bg-orange-50 border-b border-orange-200">
                  <p className="text-sm text-orange-800">
                    <strong>Recogidas asignadas:</strong> Estas son las recogidas de canastillas que tienes pendientes. Marca como completada cuando hayas recogido las canastillas.
                  </p>
                </div>
                <div className="divide-y divide-gray-200">
                  {(pickupsPendientes || []).map((pickup: any) => (
                    <div key={pickup.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">📦</span>
                            <h4 className="text-base font-semibold text-gray-900 truncate">
                              {pickup.transfer?.sale_point?.name || pickup.transfer?.external_recipient_name || 'Cliente externo'}
                            </h4>
                          </div>
                          {pickup.transfer?.sale_point?.address && (
                            <p className="text-sm text-gray-600 mb-1">
                              📍 {pickup.transfer.sale_point.address}{pickup.transfer.sale_point.city ? `, ${pickup.transfer.sale_point.city}` : ''}
                            </p>
                          )}
                          {pickup.transfer?.sale_point?.contact_phone && (
                            <p className="text-sm text-gray-600 mb-1">
                              📞 {pickup.transfer.sale_point.contact_phone}
                            </p>
                          )}
                          {!pickup.transfer?.sale_point && pickup.transfer?.external_recipient_phone && (
                            <p className="text-sm text-gray-600 mb-1">
                              📞 {pickup.transfer.external_recipient_phone}
                            </p>
                          )}
                          {pickup.transfer?.external_recipient_empresa && (
                            <p className="text-sm text-gray-500 mb-1">
                              🏢 {pickup.transfer.external_recipient_empresa}
                            </p>
                          )}
                          {pickup.transfer?.remision_number && (
                            <p className="text-xs text-purple-600 font-medium mb-1">
                              {pickup.transfer.remision_number}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              {pickup.items_count} canastilla{pickup.items_count !== 1 ? 's' : ''} por recoger
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Asignado: {formatDateTime(pickup.created_at)}
                            </span>
                            {pickup.assigned_by_user && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                Por: {pickup.assigned_by_user.first_name} {pickup.assigned_by_user.last_name}
                              </span>
                            )}
                          </div>
                          {pickup.notes && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-xs text-yellow-800">📝 {pickup.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Button
                            onClick={() => handleCompletarRecogida(pickup)}
                            className="w-full sm:w-auto"
                          >
                            ✅ Marcar Completada
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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