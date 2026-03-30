/** @module DevolucionTraspasoModal @description Modal para procesar la devolución de canastillas de un traspaso externo. */
import { useState, useEffect, useCallback } from 'react'
import { Button } from './Button'
import { FirmaDigitalModal } from './FirmaDigitalModal'
import type { Transfer, Canastilla, SignatureData } from '@/types'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/utils/helpers'
import { openRemisionTraspasoPDF, getRemisionTraspasoPDFBlob } from '@/utils/remisionTraspasoGenerator'
import { uploadSignedPDF } from '@/services/storageService'

interface DevolucionTraspasoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transfer: Transfer | null
}

interface LoteGroup {
  key: string
  size: string
  color: string
  totalDisponible: number
  cantidadDevolver: number
  canastillas: Array<{
    id: string
    transfer_item_id: string
    canastilla: Canastilla
  }>
}

export function DevolucionTraspasoModal({ isOpen, onClose, onSuccess, transfer }: DevolucionTraspasoModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [notes, setNotes] = useState('')
  const [showFirmaModal, setShowFirmaModal] = useState(false)

  const { user } = useAuthStore()

  const loadTransferItems = useCallback(async () => {
    if (!transfer) return

    setLoadingItems(true)
    setError('')

    try {
      // Obtener IDs de canastillas ya devueltas
      const returnedCanastillaIds = new Set<string>()
      const { data: existingReturns } = await supabase
        .from('transfer_returns')
        .select(`
          id,
          transfer_return_items(canastilla_id)
        `)
        .eq('transfer_id', transfer.id)

      if (existingReturns) {
        for (const ret of existingReturns) {
          if (ret.transfer_return_items) {
            for (const item of ret.transfer_return_items as Array<{ canastilla_id: string }>) {
              returnedCanastillaIds.add(item.canastilla_id)
            }
          }
        }
      }

      // Cargar TODOS los transfer_items con paginación
      const PAGE_SIZE = 1000
      let allTransferItems: Array<{ id: string; canastilla: Canastilla }> = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data: itemsBatch, error: itemsError } = await supabase
          .from('transfer_items')
          .select('id, canastilla:canastillas(*)')
          .eq('transfer_id', transfer.id)
          .range(offset, offset + PAGE_SIZE - 1)

        if (itemsError) throw itemsError

        if (itemsBatch && itemsBatch.length > 0) {
          allTransferItems = [...allTransferItems, ...itemsBatch]
          offset += PAGE_SIZE
          hasMore = itemsBatch.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Filtrar canastillas pendientes y agrupar por tamaño+color
      const pendingItems = allTransferItems
        .filter(item => item.canastilla && !returnedCanastillaIds.has(item.canastilla.id))
        .map(item => ({
          id: item.canastilla.id,
          transfer_item_id: item.id,
          canastilla: item.canastilla
        }))

      // Agrupar por size+color
      const grouped: Record<string, LoteGroup> = {}

      for (const item of pendingItems) {
        const key = `${item.canastilla.size}-${item.canastilla.color}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: item.canastilla.size,
            color: item.canastilla.color,
            totalDisponible: 0,
            cantidadDevolver: 0,
            canastillas: []
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(item)
      }

      setLotes(Object.values(grouped))
      setNotes('')
    } catch (err: unknown) {
      console.error('Error loading transfer items:', err)
      setError('Error al cargar las canastillas: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoadingItems(false)
    }
  }, [transfer])

  useEffect(() => {
    if (transfer && isOpen) {
      loadTransferItems()
    }
  }, [transfer, isOpen, loadTransferItems])

  if (!transfer) return null

  const totalCanastillasDevolver = lotes.reduce((sum, lote) => sum + lote.cantidadDevolver, 0)
  const totalCanastillasPendientes = lotes.reduce((sum, lote) => sum + lote.totalDisponible, 0)
  const pendingAfterReturn = totalCanastillasPendientes - totalCanastillasDevolver
  const isPartialReturn = pendingAfterReturn > 0 && totalCanastillasDevolver > 0

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadDevolver: Math.min(Math.max(0, cantidad), lote.totalDisponible) }
          : lote
      )
    )
  }

  const handleDevolverTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadDevolver: lote.totalDisponible }
          : lote
      )
    )
  }

  const handleDevolverTodoGlobal = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadDevolver: lote.totalDisponible }))
    )
  }

  const handleLimpiarTodo = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadDevolver: 0 }))
    )
  }

  const handlePreProcessReturn = () => {
    if (totalCanastillasDevolver === 0) {
      setError('Debe especificar al menos una canastilla para devolver')
      return
    }
    setError('')
    setShowFirmaModal(true)
  }

  const handleFirmaConfirm = async (signatureData: SignatureData) => {
    setShowFirmaModal(false)
    setLoading(true)
    setError('')

    try {
      // Seleccionar las canastillas a devolver de cada lote
      const canastillaIds: string[] = []
      const transferItemIds: string[] = []

      for (const lote of lotes) {
        if (lote.cantidadDevolver > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadDevolver)
          for (const item of seleccionadas) {
            canastillaIds.push(item.id)
            transferItemIds.push(item.transfer_item_id)
          }
        }
      }

      // 0. Verificar que el traspaso siga en estado ACEPTADO antes de procesar devolución
      const { data: currentTransfer, error: checkError } = await supabase
        .from('transfers')
        .select('status')
        .eq('id', transfer.id)
        .single()

      if (checkError) throw checkError

      if (currentTransfer.status !== 'ACEPTADO') {
        throw new Error(`No se puede procesar la devolución porque el traspaso ya fue ${currentTransfer.status.toLowerCase()}. Por favor actualiza la página.`)
      }

      // 1. Crear el registro de devolución de traspaso
      const { data: transferReturn, error: returnError } = await supabase
        .from('transfer_returns')
        .insert({
          transfer_id: transfer.id,
          return_date: new Date().toISOString(),
          notes: notes || null,
          processed_by: user?.id || '',
          firma_entrega_base64: signatureData.firma_entrega_base64,
          firma_entrega_nombre: signatureData.firma_entrega_nombre,
          firma_entrega_cedula: signatureData.firma_entrega_cedula,
          firma_recibe_base64: signatureData.firma_recibe_base64,
          firma_recibe_nombre: signatureData.firma_recibe_nombre,
          firma_recibe_cedula: signatureData.firma_recibe_cedula,
          firma_tercero_base64: signatureData.firma_tercero_base64 || null,
          firma_tercero_nombre: signatureData.firma_tercero_nombre || null,
          firma_tercero_cedula: signatureData.firma_tercero_cedula || null,
        })
        .select()
        .single()

      if (returnError) throw returnError

      // 2. Crear los items de la devolución (con batching)
      const returnItems = canastillaIds.map((canastillaId, index) => ({
        transfer_return_id: transferReturn.id,
        canastilla_id: canastillaId,
        transfer_item_id: transferItemIds[index] || null
      }))

      const BATCH_SIZE = 500
      for (let i = 0; i < returnItems.length; i += BATCH_SIZE) {
        const batch = returnItems.slice(i, i + BATCH_SIZE)
        const { error: itemsError } = await supabase
          .from('transfer_return_items')
          .insert(batch)
        if (itemsError) throw itemsError
      }

      // 3. Devolver canastillas al usuario que procesa la devolución (conductor que recoge)
      // Esto permite que un conductor diferente al que entregó pueda recoger las canastillas
      // La trazabilidad queda en: processed_by = quien recoge, from_user_id = quien entregó originalmente
      const returnToUserId = user?.id || transfer.from_user_id

      // Las canastillas EN_ALQUILER mantienen su status, las demás vuelven a DISPONIBLE
      const enAlquilerIds: string[] = []
      const otrasIds: string[] = []

      for (const lote of lotes) {
        if (lote.cantidadDevolver > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadDevolver)
          for (const item of seleccionadas) {
            if (item.canastilla.status === 'EN_ALQUILER') {
              enAlquilerIds.push(item.id)
            } else {
              otrasIds.push(item.id)
            }
          }
        }
      }

      // Canastillas normales → DISPONIBLE
      for (let i = 0; i < otrasIds.length; i += BATCH_SIZE) {
        const batch = otrasIds.slice(i, i + BATCH_SIZE)
        const { error: canastillasError } = await supabase
          .from('canastillas')
          .update({
            current_owner_id: returnToUserId,
            status: 'DISPONIBLE',
          })
          .in('id', batch)
        if (canastillasError) throw canastillasError
      }

      // Canastillas EN_ALQUILER → mantener status, solo cambiar owner
      for (let i = 0; i < enAlquilerIds.length; i += BATCH_SIZE) {
        const batch = enAlquilerIds.slice(i, i + BATCH_SIZE)
        const { error: canastillasError } = await supabase
          .from('canastillas')
          .update({
            current_owner_id: returnToUserId,
          })
          .in('id', batch)
        if (canastillasError) throw canastillasError
      }

      // 4. Actualizar contadores del traspaso - re-leer valores actuales para evitar race condition
      const { data: freshTransfer, error: freshError } = await supabase
        .from('transfers')
        .select('returned_items_count, pending_items_count, items_count, status')
        .eq('id', transfer.id)
        .single()

      if (freshError) throw freshError

      if (freshTransfer.status !== 'ACEPTADO') {
        throw new Error(`No se pudo completar la devolución porque el traspaso cambió a estado ${freshTransfer.status.toLowerCase()}.`)
      }

      const currentReturned = freshTransfer.returned_items_count || 0
      const currentPending = freshTransfer.pending_items_count ?? (freshTransfer.items_count || 0)
      const newReturnedCount = currentReturned + canastillaIds.length
      const newPendingCount = Math.max(0, currentPending - canastillaIds.length)

      await supabase
        .from('transfers')
        .update({
          returned_items_count: newReturnedCount,
          pending_items_count: newPendingCount,
        })
        .eq('id', transfer.id)

      // 5. Subir PDF firmado a storage
      try {
        // Obtener transfer completo para PDF
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
          // Obtener todos los items del transfer
          let allItems: Array<{ id: string; canastilla: Canastilla }> = []
          let hasMoreItems = true
          let offsetItems = 0

          while (hasMoreItems) {
            const { data: itemsBatch } = await supabase
              .from('transfer_items')
              .select('*, canastilla:canastillas(*)')
              .eq('transfer_id', transfer.id)
              .range(offsetItems, offsetItems + 1000 - 1)

            if (itemsBatch && itemsBatch.length > 0) {
              allItems = [...allItems, ...itemsBatch]
              offsetItems += 1000
              hasMoreItems = itemsBatch.length === 1000
            } else {
              hasMoreItems = false
            }
          }

          const fullTransfer = { ...transferBase, transfer_items: allItems } as unknown as Transfer

          const pdfBlob = await getRemisionTraspasoPDFBlob(fullTransfer, signatureData)
          const pdfUrl = await uploadSignedPDF(pdfBlob, 'transfer-returns', `Devolucion_${transfer.remision_number}_${Date.now()}.pdf`)
          if (pdfUrl) {
            await supabase.from('transfer_returns').update({ signed_pdf_url: pdfUrl }).eq('id', transferReturn.id)
          }

          await openRemisionTraspasoPDF(fullTransfer, signatureData)
        }
      } catch (pdfErr) {
        console.error('Error al generar PDF de devolución:', pdfErr)
      }

      const message = isPartialReturn
        ? `Devolución parcial procesada\n\nCanastillas devueltas: ${canastillaIds.length}\nPendientes: ${pendingAfterReturn}`
        : `Devolución completa procesada\n\nCanastillas devueltas: ${canastillaIds.length}`

      alert(message)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      console.error('Error processing return:', err)
      setError(err instanceof Error ? err.message : 'Error al procesar la devolución')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-orange-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Devolución de Traspaso Externo
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-white hover:text-gray-200 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-h-[65vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Información del cliente/destinatario y traspaso */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  {(transfer as any).sale_point ? 'Cliente' : 'Destinatario Externo'}
                </h4>
                <div className="p-3 sm:p-4 bg-orange-50 rounded-lg">
                  {(transfer as any).sale_point ? (
                    <>
                      <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {(transfer as any).sale_point.name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Contacto: {(transfer as any).sale_point.contact_name}
                      </p>
                      {(transfer as any).sale_point.identification && (
                        <p className="text-xs sm:text-sm text-gray-500">NIT/CC: {(transfer as any).sale_point.identification}</p>
                      )}
                      {(transfer as any).sale_point.contact_phone && (
                        <p className="text-xs sm:text-sm text-gray-500">Tel: {(transfer as any).sale_point.contact_phone}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {transfer.external_recipient_name || transfer.to_user?.first_name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">
                        Cédula: {transfer.external_recipient_cedula || '-'}
                      </p>
                      {transfer.external_recipient_empresa && (
                        <p className="text-xs sm:text-sm text-gray-500">{transfer.external_recipient_empresa}</p>
                      )}
                      {transfer.external_recipient_phone && (
                        <p className="text-xs sm:text-sm text-gray-500">Tel: {transfer.external_recipient_phone}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Detalles del Traspaso</h4>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                      EXTERNO
                    </span>
                    <span className="text-xs text-gray-500">
                      {transfer.remision_number || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Fecha: {formatDate(transfer.requested_at)}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900">
                    Total: {transfer.items_count || 0} canastillas
                  </p>
                  {(transfer.returned_items_count || 0) > 0 && (
                    <p className="text-xs sm:text-sm text-green-600">
                      Devueltas: {transfer.returned_items_count}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Selector de cantidades por lote */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Canastillas a Devolver por Lote
                </h4>
                {!loadingItems && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDevolverTodoGlobal}
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Devolver todas
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

              {loadingItems ? (
                <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando canastillas...</p>
                  </div>
                </div>
              ) : lotes.length === 0 ? (
                <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-500">No hay canastillas pendientes de devolución</p>
                </div>
              ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header de la tabla */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                  <div className="col-span-5">Lote (Tamaño - Color)</div>
                  <div className="col-span-2 text-center">Pendientes</div>
                  <div className="col-span-3 text-center">Devolver</div>
                  <div className="col-span-2 text-center">Acción</div>
                </div>

                {/* Filas de lotes */}
                <div className="divide-y divide-gray-100">
                  {lotes.map((lote) => (
                    <div key={lote.key} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                      <div className="col-span-5">
                        <span className="text-sm font-medium text-gray-900">
                          {lote.size} - {lote.color}
                        </span>
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
                          value={lote.cantidadDevolver || ''}
                          onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div className="col-span-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDevolverTodo(lote.key)}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
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
                    {totalCanastillasPendientes}
                  </div>
                  <div className="col-span-3 text-center text-sm font-bold text-orange-600">
                    {totalCanastillasDevolver}
                  </div>
                  <div className="col-span-2"></div>
                </div>
              </div>
              )}

              {/* Indicador de restantes */}
              {totalCanastillasDevolver > 0 && (
                <div className="mt-2 text-sm">
                  {isPartialReturn ? (
                    <span className="text-orange-600 font-medium">
                      Quedarán {pendingAfterReturn} canastillas pendientes de devolución
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium">
                      Se devolverán todas las canastillas
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                placeholder="Observaciones sobre la devolución..."
              />
            </div>

            {/* Alertas */}
            {isPartialReturn && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-orange-800">Devolución Parcial</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Quedarán <strong>{pendingAfterReturn}</strong> canastillas pendientes con el destinatario externo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {totalCanastillasDevolver === totalCanastillasPendientes && totalCanastillasDevolver > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>✓</strong> Devolución completa - Todas las canastillas serán devueltas
                </p>
                <p className="text-sm text-green-800 mt-1">
                  <strong>✓</strong> Las canastillas volverán a estado <strong>DISPONIBLE</strong>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto text-sm order-2 sm:order-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePreProcessReturn}
              loading={loading}
              disabled={loading || loadingItems || totalCanastillasDevolver === 0}
              className="w-full sm:w-auto text-sm order-1 sm:order-2 !bg-orange-600 hover:!bg-orange-700"
            >
              {loading
                ? 'Procesando...'
                : isPartialReturn
                  ? `Devolución Parcial (${totalCanastillasDevolver})`
                  : `Devolver Todo (${totalCanastillasDevolver})`
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Firma Digital */}
      <FirmaDigitalModal
        isOpen={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        onConfirm={handleFirmaConfirm}
        loading={loading}
        title="Firmas de Devolución"
        entregaLabel="ENTREGA (Externo)"
        recibeLabel="RECIBE (Empresa)"
        mode="both"
        confirmButtonText="Firmar y Procesar Devolución"
        allowTercero
      />
    </div>
  )
}
