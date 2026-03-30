/**
 * @module usePdvInventory
 * @description Hook para la gestión del inventario de puntos de venta (PDV).
 * Controla el flujo de cargue mensual obligatorio, extensiones de plazo,
 * tipos de canastilla disponibles e historial de cargues.
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  isLastDayOfMonth,
  getDaysUntilLastDay,
  getCurrentPeriod,
  hasUploadedThisMonth,
  hasExtensionAvailable,
  getCanastillaTypes,
  createInventoryUpload,
  getMyCurrentUpload,
  getMyUploadHistory,
  type UploadItem,
  type PdvUpload,
  type PdvExtension,
} from '@/services/pdvInventoryService'

/**
 * Hook que gestiona el inventario mensual de puntos de venta.
 * @returns Objeto con estado del cargue, permisos, historial y funciones de envío.
 * @returns {boolean} isPdv - Si el usuario tiene rol PDV.
 * @returns {boolean} isLastDay - Si hoy es el último día del mes.
 * @returns {boolean} hasUploaded - Si ya realizó el cargue este mes.
 * @returns {boolean} canUpload - Si puede realizar el cargue.
 * @returns {boolean} isBlocked - Si está bloqueado por no haber hecho el cargue.
 * @returns {Function} submitUpload - Envía el cargue de inventario.
 * @returns {Function} getReminderMessage - Obtiene mensaje de recordatorio.
 */
export function usePdvInventory() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [hasUploaded, setHasUploaded] = useState(false)
  const [extension, setExtension] = useState<PdvExtension | null>(null)
  const [canastillaTypes, setCanastillaTypes] = useState<{ size: string; color: string; total: number }[]>([])
  const [currentUpload, setCurrentUpload] = useState<PdvUpload | null>(null)
  const [uploadHistory, setUploadHistory] = useState<PdvUpload[]>([])
  const [submitting, setSubmitting] = useState(false)

  const isPdv = user?.role === 'pdv'
  const isLastDay = isLastDayOfMonth()
  const daysUntilLastDay = getDaysUntilLastDay()
  const { month, year } = getCurrentPeriod()

  // ¿Puede hacer cargue? Solo el último día del mes O si tiene extensión
  const canUpload = (isLastDay || !!extension) && !hasUploaded

  // ¿Debe estar bloqueado? Último día, no ha cargado, es PDV
  const isBlocked = isPdv && isLastDay && !hasUploaded

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [uploaded, ext, types, current, history] = await Promise.all([
        hasUploadedThisMonth(user.id),
        hasExtensionAvailable(user.id),
        getCanastillaTypes(),
        getMyCurrentUpload(user.id),
        getMyUploadHistory(user.id),
      ])
      setHasUploaded(uploaded)
      setExtension(ext)
      setCanastillaTypes(types)
      setCurrentUpload(current)
      setUploadHistory(history)
    } catch (error) {
      console.error('Error fetching PDV status:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const submitUpload = async (items: UploadItem[]) => {
    if (!user?.id) throw new Error('No hay usuario')
    setSubmitting(true)
    try {
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
      const userCedula = user.phone || null // Usamos phone como cédula si está disponible
      const upload = await createInventoryUpload(user.id, userName, userCedula, items)
      setHasUploaded(true)
      setCurrentUpload(upload)
      await fetchStatus()
      return upload
    } finally {
      setSubmitting(false)
    }
  }

  // Mensaje de recordatorio
  const getReminderMessage = (): string | null => {
    if (hasUploaded) return null
    if (!isPdv) return null
    if (isLastDay) return '¡Hoy es el último día del mes! Debe realizar el cargue de inventario.'
    if (daysUntilLastDay <= 5 && daysUntilLastDay > 0) {
      return `Recordatorio: en ${daysUntilLastDay} día${daysUntilLastDay > 1 ? 's' : ''} debe realizar el cargue de inventario.`
    }
    return null
  }

  return {
    loading,
    isPdv,
    isLastDay,
    daysUntilLastDay,
    month,
    year,
    hasUploaded,
    extension,
    canUpload,
    isBlocked,
    canastillaTypes,
    currentUpload,
    uploadHistory,
    submitting,
    submitUpload,
    getReminderMessage,
    refresh: fetchStatus,
  }
}
