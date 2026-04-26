/**
 * @module UserStatsModal
 * @description Modal con estadísticas detalladas de un usuario: entradas/salidas, traspasos y trazabilidad diaria.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { LocationData } from '@/hooks/useDashboardStats'

interface UserStatsModalProps {
  location: LocationData
  onClose: () => void
}

interface TransferStats {
  pendientes: number
  aceptados: number
  rechazados: number
  aceptadoAuto: number
  cancelados: number
}

interface MovimientoDiario {
  id: string
  tipo: 'entrada' | 'salida'
  fecha: string
  cantidad: number
  remision: string | null
  status: string
  contraparte: string
  isExternal: boolean
  isWashing: boolean
}

export function UserStatsModal({ location, onClose }: UserStatsModalProps) {
  const [loading, setLoading] = useState(true)
  const [entradasHoy, setEntradasHoy] = useState(0)
  const [salidasHoy, setSalidasHoy] = useState(0)
  const [entradasMes, setEntradasMes] = useState(0)
  const [salidasMes, setSalidasMes] = useState(0)
  const [traspasosHoy, setTraspasosHoy] = useState<TransferStats>({ pendientes: 0, aceptados: 0, rechazados: 0, aceptadoAuto: 0, cancelados: 0 })
  const [traspasosMes, setTraspasosMes] = useState<TransferStats>({ pendientes: 0, aceptados: 0, rechazados: 0, aceptadoAuto: 0, cancelados: 0 })
  const [movimientos, setMovimientos] = useState<MovimientoDiario[]>([])
  const [tabTrazabilidad, setTabTrazabilidad] = useState<'hoy' | 'fecha'>('hoy')
  const [selectedDate, setSelectedDate] = useState('')
  const [movimientosFecha, setMovimientosFecha] = useState<MovimientoDiario[]>([])
  const [loadingFecha, setLoadingFecha] = useState(false)

  const isClient = location.userId.startsWith('client_')

  useEffect(() => {
    if (!isClient) {
      fetchUserStats()
    } else {
      setLoading(false)
    }
  }, [location.userId])

  const fetchUserStats = async () => {
    setLoading(true)
    try {
      const userId = location.userId
      const now = new Date()
      // Usar fecha LOCAL (no UTC) para comparar "hoy"
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // 1. Traspasos del mes: solicitados O respondidos este mes
      const selectFields = 'id, from_user_id, to_user_id, status, requested_at, responded_at, remision_number, is_external_transfer, is_washing_transfer, from_user:from_user_id(first_name, last_name), to_user:to_user_id(first_name, last_name)'

      const [{ data: byRequested }, { data: byResponded }] = await Promise.all([
        supabase
          .from('transfers')
          .select(selectFields)
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .gte('requested_at', firstDayOfMonth)
          .order('requested_at', { ascending: false }),
        supabase
          .from('transfers')
          .select(selectFields)
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .gte('responded_at', firstDayOfMonth)
          .order('requested_at', { ascending: false }),
      ])

      // Combinar sin duplicados
      const seenIds = new Set<string>()
      const transfersMes = [...(byRequested || []), ...(byResponded || [])].filter(t => {
        if (seenIds.has(t.id)) return false
        seenIds.add(t.id)
        return true
      })

      if (transfersMes.length === 0) {
        setLoading(false)
        return
      }

      // 2. Contar items por cada transfer usando count exact
      const itemCounts: Record<string, number> = {}
      await Promise.all(
        transfersMes.map(async (t) => {
          const { count } = await supabase
            .from('transfer_items')
            .select('*', { count: 'exact', head: true })
            .eq('transfer_id', t.id)
          itemCounts[t.id] = count || 0
        })
      )

      // 3. Calcular estadísticas
      let entHoy = 0, salHoy = 0, entMes = 0, salMes = 0
      const tHoy: TransferStats = { pendientes: 0, aceptados: 0, rechazados: 0, aceptadoAuto: 0, cancelados: 0 }
      const tMes: TransferStats = { pendientes: 0, aceptados: 0, rechazados: 0, aceptadoAuto: 0, cancelados: 0 }
      const movs: MovimientoDiario[] = []

      for (const t of transfersMes) {
        const count = itemCounts[t.id] || 0
        const isEntrada = t.to_user_id === userId
        const isSalida = t.from_user_id === userId
        const isCompleted = t.status === 'ACEPTADO' || t.status === 'ACEPTADO_AUTO'
        const isPending = t.status === 'PENDIENTE'

        // Para aceptados/rechazados usar responded_at, para pendientes usar requested_at
        const relevantDate = (isPending ? t.requested_at : t.responded_at) || t.requested_at
        // Convertir a fecha LOCAL para comparar con "hoy"
        const localDate = relevantDate ? new Date(relevantDate) : null
        const relevantDay = localDate ? `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}` : ''
        const isToday = relevantDay === todayStr

        // Solo contar entradas/salidas y trazabilidad si tiene remisión
        if (t.remision_number) {
          if (isCompleted && isEntrada) {
            entMes += count
            if (isToday) entHoy += count
          }
          if (isCompleted && isSalida) {
            salMes += count
            if (isToday) salHoy += count
          }
        }

        // Contar estados de traspasos
        const countStatus = (stats: TransferStats) => {
          switch (t.status) {
            case 'PENDIENTE': stats.pendientes++; break
            case 'ACEPTADO': stats.aceptados++; break
            case 'RECHAZADO': stats.rechazados++; break
            case 'ACEPTADO_AUTO': stats.aceptadoAuto++; break
            case 'CANCELADO': stats.cancelados++; break
          }
        }
        countStatus(tMes)
        if (isToday) countStatus(tHoy)

        // Movimientos del día para trazabilidad - solo con remisión
        if (isToday && (isCompleted || isPending) && t.remision_number) {
          const fromUser = t.from_user as { first_name: string; last_name: string } | null
          const toUser = t.to_user as { first_name: string; last_name: string } | null
          const contraparte = isEntrada
            ? (fromUser ? `${fromUser.first_name} ${fromUser.last_name}`.trim() : 'Desconocido')
            : (toUser ? `${toUser.first_name} ${toUser.last_name}`.trim() : 'Desconocido')

          movs.push({
            id: t.id,
            tipo: isEntrada ? 'entrada' : 'salida',
            fecha: relevantDate,
            cantidad: count,
            remision: t.remision_number || null,
            status: t.status,
            contraparte,
            isExternal: !!(t.is_external_transfer),
            isWashing: !!(t.is_washing_transfer),
          })
        }
      }

      movs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      setEntradasHoy(entHoy)
      setSalidasHoy(salHoy)
      setEntradasMes(entMes)
      setSalidasMes(salMes)
      setTraspasosHoy(tHoy)
      setTraspasosMes(tMes)
      setMovimientos(movs)
    } catch (error) {
      console.error('Error fetching user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMovimientosFecha = async (dateStr: string) => {
    if (!dateStr) return
    setLoadingFecha(true)
    try {
      const userId = location.userId
      // dateStr viene como YYYY-MM-DD
      const startOfDay = `${dateStr}T00:00:00`
      const endOfDay = `${dateStr}T23:59:59`
      const selectFields = 'id, from_user_id, to_user_id, status, requested_at, responded_at, remision_number, is_external_transfer, is_washing_transfer, from_user:from_user_id(first_name, last_name), to_user:to_user_id(first_name, last_name)'

      const [{ data: byRequested }, { data: byResponded }] = await Promise.all([
        supabase
          .from('transfers')
          .select(selectFields)
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .gte('requested_at', startOfDay)
          .lte('requested_at', endOfDay)
          .order('requested_at', { ascending: false }),
        supabase
          .from('transfers')
          .select(selectFields)
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
          .gte('responded_at', startOfDay)
          .lte('responded_at', endOfDay)
          .order('requested_at', { ascending: false }),
      ])

      const seenIds = new Set<string>()
      const transfers = [...(byRequested || []), ...(byResponded || [])].filter(t => {
        if (seenIds.has(t.id)) return false
        seenIds.add(t.id)
        return true
      })

      const movs: MovimientoDiario[] = []
      for (const t of transfers) {
        const isCompleted = t.status === 'ACEPTADO' || t.status === 'ACEPTADO_AUTO'
        const isPending = t.status === 'PENDIENTE'
        if (!(isCompleted || isPending) || !t.remision_number) continue

        const { count } = await supabase
          .from('transfer_items')
          .select('*', { count: 'exact', head: true })
          .eq('transfer_id', t.id)

        const isEntrada = t.to_user_id === userId
        const relevantDate = (isPending ? t.requested_at : t.responded_at) || t.requested_at
        const fromUser = t.from_user as { first_name: string; last_name: string } | null
        const toUser = t.to_user as { first_name: string; last_name: string } | null
        const contraparte = isEntrada
          ? (fromUser ? `${fromUser.first_name} ${fromUser.last_name}`.trim() : 'Desconocido')
          : (toUser ? `${toUser.first_name} ${toUser.last_name}`.trim() : 'Desconocido')

        movs.push({
          id: t.id,
          tipo: isEntrada ? 'entrada' : 'salida',
          fecha: relevantDate,
          cantidad: count || 0,
          remision: t.remision_number || null,
          status: t.status,
          contraparte,
          isExternal: !!(t.is_external_transfer),
          isWashing: !!(t.is_washing_transfer),
        })
      }
      movs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setMovimientosFecha(movs)
    } catch (error) {
      console.error('Error fetching movimientos por fecha:', error)
    } finally {
      setLoadingFecha(false)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACEPTADO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      ACEPTADO_AUTO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      PENDIENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      RECHAZADO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      CANCELADO: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    }
    const labels: Record<string, string> = {
      ACEPTADO: 'Aceptado',
      ACEPTADO_AUTO: 'Auto-aceptado',
      PENDIENTE: 'Pendiente',
      RECHAZADO: 'Rechazado',
      CANCELADO: 'Cancelado',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-20 pb-4 sm:px-8 sm:pt-24 sm:pb-8 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {isClient ? (
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
              {location.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isClient ? location.area : `${location.ubicacion} · ${location.area}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Inventario actual */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Inventario actual
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                  <StatBox label="Total" value={location.total} color="gray" />
                  <StatBox label="Disponibles" value={location.disponibles} color="green" />
                </div>
              </div>

              {!isClient && (
                <>
                  {/* Entradas y Salidas */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      Entradas y Salidas
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center border border-emerald-200 dark:border-emerald-800">
                        <p className="text-2xl font-bold text-emerald-600">{entradasHoy}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Entradas hoy</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center border border-red-200 dark:border-red-800">
                        <p className="text-2xl font-bold text-red-600">{salidasHoy}</p>
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">Salidas hoy</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center border border-emerald-200 dark:border-emerald-800">
                        <p className="text-2xl font-bold text-emerald-600">{entradasMes}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Entradas mes</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center border border-red-200 dark:border-red-800">
                        <p className="text-2xl font-bold text-red-600">{salidasMes}</p>
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">Salidas mes</p>
                      </div>
                    </div>
                  </div>

                  {/* Traspasos */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Traspasos
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Hoy */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Hoy</p>
                        <div className="grid grid-cols-5 gap-1">
                          <MiniStat label="Pend." value={traspasosHoy.pendientes} color="yellow" />
                          <MiniStat label="Acept." value={traspasosHoy.aceptados} color="green" />
                          <MiniStat label="Rech." value={traspasosHoy.rechazados} color="red" />
                          <MiniStat label="Auto" value={traspasosHoy.aceptadoAuto} color="blue" />
                          <MiniStat label="Canc." value={traspasosHoy.cancelados} color="gray" />
                        </div>
                      </div>
                      {/* Mes */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Este mes</p>
                        <div className="grid grid-cols-5 gap-1">
                          <MiniStat label="Pend." value={traspasosMes.pendientes} color="yellow" />
                          <MiniStat label="Acept." value={traspasosMes.aceptados} color="green" />
                          <MiniStat label="Rech." value={traspasosMes.rechazados} color="red" />
                          <MiniStat label="Auto" value={traspasosMes.aceptadoAuto} color="blue" />
                          <MiniStat label="Canc." value={traspasosMes.cancelados} color="gray" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trazabilidad */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Trazabilidad
                    </h3>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-3">
                      <button
                        onClick={() => setTabTrazabilidad('hoy')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          tabTrazabilidad === 'hoy'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        Hoy
                      </button>
                      <button
                        onClick={() => setTabTrazabilidad('fecha')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          tabTrazabilidad === 'fecha'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        Por fecha
                      </button>
                    </div>

                    {tabTrazabilidad === 'hoy' ? (
                      /* Trazabilidad del día */
                      movimientos.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                          <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <p className="text-sm">Sin movimientos hoy</p>
                        </div>
                      ) : (
                        <MovimientosList movimientos={movimientos} statusBadge={statusBadge} />
                      )
                    ) : (
                      /* Trazabilidad por fecha */
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              setSelectedDate(e.target.value)
                              fetchMovimientosFecha(e.target.value)
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        {!selectedDate ? (
                          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                            <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm">Selecciona una fecha para consultar</p>
                          </div>
                        ) : loadingFecha ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                          </div>
                        ) : movimientosFecha.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                            <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-sm">Sin movimientos en esta fecha</p>
                          </div>
                        ) : (
                          <MovimientosList movimientos={movimientosFecha} statusBadge={statusBadge} />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    pink: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  }
  return (
    <div className={`rounded-lg p-2 text-center border ${colors[color] || colors.gray}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-medium">{label}</p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'text-yellow-600',
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-500',
  }
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${colors[color] || 'text-gray-600'}`}>{value}</p>
      <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">{label}</p>
    </div>
  )
}

function MovimientosList({ movimientos, statusBadge }: { movimientos: MovimientoDiario[]; statusBadge: (status: string) => JSX.Element }) {
  return (
    <div className="space-y-2">
      {movimientos.map((mov) => (
        <div
          key={mov.id}
          className={`rounded-xl border p-3 transition-colors ${
            mov.tipo === 'entrada'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
              : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {mov.tipo === 'entrada' ? (
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {mov.tipo === 'entrada' ? 'Recibió de' : 'Envió a'}{' '}
                  <span className="text-primary-600 dark:text-primary-400">{mov.contraparte}</span>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {mov.isWashing && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 font-medium">Lavado</span>
                  )}
                  {mov.isExternal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">Externo</span>
                  )}
                  {mov.remision && (
                    <span className="text-[10px] text-gray-400">Rem: {mov.remision}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <span className={`text-lg font-bold ${mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
              </span>
              {statusBadge(mov.status)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md px-2 py-0.5">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-mono font-medium text-gray-600 dark:text-gray-300">
                {new Date(mov.fecha).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
