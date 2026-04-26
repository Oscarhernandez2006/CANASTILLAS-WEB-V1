/** @module Inventario @description Componente de vista de inventario de canastillas. */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import { useAuthStore } from '@/store/authStore'

interface LoteItem {
  id: string
  color: string
  size: string
  shape?: string
  condition?: string
  tipoPropiedad: 'PROPIA' | 'ALQUILADA'
  estado: string
  cantidad: number
  canastillas: string[]
}

const CONSULTOR_PROCESO_EXCLUIR_PREFIX = 'PDV'
const CONSULTOR_PROCESO_EXCLUIR_EXACTOS = ['CANASTILLERO', 'EN TRANSITO', 'INVERSIONES SERRANO', 'LA PARISIENNE', 'OFICINA DE SISTEMAS']

interface ConsultorUsuario {
  id: string
  first_name: string
  last_name: string
  email: string
  department: string
  totalCanastillas: number
}

interface ConsultorLote {
  key: string
  size: string
  color: string
  shape: string
  condition: string
  tipo_propiedad: string
  status: string
  cantidad: number
}

export function Inventario() {
  const [lotes, setLotes] = useState<LoteItem[]>([])
  const [lotesPaginados, setLotesPaginados] = useState<LoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { user } = useAuthStore()

  // Estadísticas de canastillas
  const [totalCanastillas, setTotalCanastillas] = useState(0)
  const [canastillasDisponibles, setCanastillasDisponibles] = useState(0)
  const [canastillasEnTraspaso, setCanastillasEnTraspaso] = useState(0)
  const [canastillasEnLavado, setCanastillasEnLavado] = useState(0)
  const [canastillasEnRetorno, setCanastillasEnRetorno] = useState(0)
  const [recibiendoRetorno, setRecibiendoRetorno] = useState(false)

  // Verificar si el usuario es super_admin
  const isSuperAdmin = user?.role === 'super_admin'
  const isConsultorProceso = user?.role === 'consultor_proceso'

  // Estados para consultor_proceso
  const [consultorUsuarios, setConsultorUsuarios] = useState<ConsultorUsuario[]>([])
  const [consultorSelectedUser, setConsultorSelectedUser] = useState<ConsultorUsuario | null>(null)
  const [consultorLotes, setConsultorLotes] = useState<ConsultorLote[]>([])
  const [consultorLoadingLotes, setConsultorLoadingLotes] = useState(false)
  const [consultorTraspasos, setConsultorTraspasos] = useState<any[]>([])
  const [consultorVistaActiva, setConsultorVistaActiva] = useState<'canastillas' | 'traspasos'>('canastillas')

  useEffect(() => {
    if (user) {
      if (isConsultorProceso) {
        cargarUsuariosConsultor()
      } else {
        cargarInventario()
      }
    }
  }, [user])

  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setLotesPaginados(lotes.slice(startIndex, endIndex))
  }, [lotes, currentPage])

  const cargarUsuariosConsultor = async () => {
    try {
      setLoading(true)
      setError(null)

      // Cargar usuarios excluyendo los de PDV (puntos de venta)
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, department')
        .eq('is_active', true)
        .not('department', 'is', null)
        .order('department')

      if (usersErr) throw usersErr

      // Filtrar excluyendo PDV, CANASTILLERO, EN TRANSITO, INVERSIONES SERRANO, LA PARISIENNE
      const filteredUsers = (usersData || []).filter(u => {
        const dept = (u.department || '').toUpperCase()
        if (!dept) return false
        if (dept.startsWith(CONSULTOR_PROCESO_EXCLUIR_PREFIX)) return false
        if (CONSULTOR_PROCESO_EXCLUIR_EXACTOS.includes(dept)) return false
        return true
      })

      // Para cada usuario, contar sus canastillas
      const usersWithCounts: ConsultorUsuario[] = await Promise.all(
        filteredUsers.map(async (u) => {
          const { count } = await supabase
            .from('canastillas')
            .select('*', { count: 'exact', head: true })
            .eq('current_owner_id', u.id)
          return {
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            department: u.department || '',
            totalCanastillas: count || 0,
          }
        })
      )

      setConsultorUsuarios(usersWithCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const cargarLotesUsuarioConsultor = async (userId: string) => {
    setConsultorLoadingLotes(true)
    setConsultorLotes([])

    try {
      const PAGE_SIZE = 1000
      let allCanastillas: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: err } = await supabase
          .from('canastillas')
          .select('size, color, shape, status, condition, tipo_propiedad')
          .eq('current_owner_id', userId)
          .range(offset, offset + PAGE_SIZE - 1)

        if (err) throw err
        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Agrupar por lote
      const grouped: Record<string, ConsultorLote> = {}
      for (const c of allCanastillas) {
        const key = `${c.size}-${c.color}-${c.shape || 'N/A'}-${c.condition || 'N/A'}-${c.tipo_propiedad || 'PROPIA'}-${c.status}`
        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: c.size,
            color: c.color,
            shape: c.shape || 'N/A',
            condition: c.condition || 'N/A',
            tipo_propiedad: c.tipo_propiedad || 'PROPIA',
            status: c.status,
            cantidad: 0,
          }
        }
        grouped[key].cantidad++
      }

      const sorted = Object.values(grouped).sort((a, b) => {
        if (a.status !== b.status) return a.status.localeCompare(b.status)
        if (a.size !== b.size) return a.size.localeCompare(b.size)
        return a.color.localeCompare(b.color)
      })

      setConsultorLotes(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lotes')
    } finally {
      setConsultorLoadingLotes(false)
    }
  }

  const cargarTraspasosUsuarioConsultor = async (userId: string) => {
    setConsultorLoadingLotes(true)
    setConsultorTraspasos([])
    try {
      // Traspasos donde el usuario es remitente o destinatario
      const { data: enviados, error: errEnv } = await supabase
        .from('transfers')
        .select(`
          id, status, requested_at, responded_at, remision_number,
          items_count:transfer_items(count),
          from_user:from_user_id(first_name, last_name),
          to_user:to_user_id(first_name, last_name)
        `)
        .eq('from_user_id', userId)
        .in('status', ['PENDIENTE', 'ACEPTADO', 'RECHAZADO'])
        .order('requested_at', { ascending: false })
        .limit(50)

      if (errEnv) console.error('Error fetching enviados:', errEnv)

      const { data: recibidos, error: errRec } = await supabase
        .from('transfers')
        .select(`
          id, status, requested_at, responded_at, remision_number,
          items_count:transfer_items(count),
          from_user:from_user_id(first_name, last_name),
          to_user:to_user_id(first_name, last_name)
        `)
        .eq('to_user_id', userId)
        .in('status', ['PENDIENTE', 'ACEPTADO', 'RECHAZADO'])
        .order('requested_at', { ascending: false })
        .limit(50)

      if (errRec) console.error('Error fetching recibidos:', errRec)

      const all = [
        ...(enviados || []).map((t: any) => ({ ...t, direccion: 'ENVIADO' })),
        ...(recibidos || []).map((t: any) => ({ ...t, direccion: 'RECIBIDO' })),
      ]
      // Eliminar duplicados (si envió a sí mismo) y ordenar por fecha
      const unique = Array.from(new Map(all.map(t => [`${t.id}-${t.direccion}`, t])).values())
      unique.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())

      setConsultorTraspasos(unique)
    } catch (err) {
      console.error('Error al cargar traspasos:', err)
    } finally {
      setConsultorLoadingLotes(false)
    }
  }

  const cargarInventario = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) return

      // 1. Obtener IDs de canastillas en traspasos PENDIENTES del usuario actual
      let canastillasRetenidas: string[] = []

      {
        let transferQuery = supabase
          .from('transfers')
          .select('id')
          .eq('status', 'PENDIENTE')

        // Para todos los usuarios, filtrar por sus traspasos salientes
        // Super_admin ve todos los traspasos pendientes del sistema
        if (!isSuperAdmin) {
          transferQuery = transferQuery.eq('from_user_id', user.id)
        }

        const { data: traspasosPendientes, error: errorTraspasos } = await transferQuery

        if (!errorTraspasos && traspasosPendientes && traspasosPendientes.length > 0) {
          const transferIds = traspasosPendientes.map(t => t.id)

          // Paginar en lotes de 500 para no exceder límites de IN clause
          const BATCH_SIZE = 500
          for (let i = 0; i < transferIds.length; i += BATCH_SIZE) {
            const batch = transferIds.slice(i, i + BATCH_SIZE)

            // Paginar resultados (Supabase limita a 1000 filas por query)
            let itemOffset = 0
            let hasMoreItems = true
            const ITEMS_PAGE = 1000

            while (hasMoreItems) {
              const { data: itemsRetenidos, error: errorItems } = await supabase
                .from('transfer_items')
                .select('canastilla_id')
                .in('transfer_id', batch)
                .range(itemOffset, itemOffset + ITEMS_PAGE - 1)

              if (!errorItems && itemsRetenidos && itemsRetenidos.length > 0) {
                canastillasRetenidas = [...canastillasRetenidas, ...itemsRetenidos.map(item => item.canastilla_id)]
                itemOffset += ITEMS_PAGE
                hasMoreItems = itemsRetenidos.length === ITEMS_PAGE
              } else {
                hasMoreItems = false
              }
            }
          }
        }
      }

      // 2. Cargar TODAS las canastillas usando paginación interna
      // Supabase limita a 1000 filas por consulta, así que cargamos en lotes
      const PAGE_SIZE = 1000
      let allCanastillas: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        let canastillasQuery = supabase
          .from('canastillas')
          .select('id, codigo, status, color, size, shape, condition, tipo_propiedad, current_owner_id')

        // Si NO es super_admin, filtrar solo las canastillas del usuario actual
        if (!isSuperAdmin) {
          canastillasQuery = canastillasQuery.eq('current_owner_id', user.id)
        }

        const { data: canastillas, error: canErr } = await canastillasQuery
          .order('codigo', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (canErr) throw canErr

        if (canastillas && canastillas.length > 0) {
          allCanastillas = [...allCanastillas, ...canastillas]
          offset += PAGE_SIZE
          // Si recibimos menos de PAGE_SIZE, ya no hay más datos
          hasMore = canastillas.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      const canastillas = allCanastillas

      // 3. Calcular estadísticas
      const todasLasCanastillas = canastillas || []
      const totalCount = todasLasCanastillas.length

      // Canastillas con status DISPONIBLE
      const canastillasStatusDisponible = todasLasCanastillas.filter(c => c.status === 'DISPONIBLE')

      // Canastillas con status EN_LAVADO
      const canastillasStatusLavado = todasLasCanastillas.filter(c => c.status === 'EN_LAVADO')
      const enLavadoCount = canastillasStatusLavado.length

      // Canastillas con status EN_RETORNO
      const canastillasStatusRetorno = todasLasCanastillas.filter(c => c.status === 'EN_RETORNO')
      const enRetornoCount = canastillasStatusRetorno.length

      // De las disponibles, cuántas están retenidas en traspasos pendientes
      const retenidasCount = canastillasStatusDisponible.filter(c =>
        canastillasRetenidas.includes(c.id)
      ).length

      // Disponibles reales = status DISPONIBLE y NO retenidas
      const disponiblesCount = canastillasStatusDisponible.length - retenidasCount

      setTotalCanastillas(totalCount)
      setCanastillasEnTraspaso(retenidasCount)
      setCanastillasDisponibles(disponiblesCount)
      setCanastillasEnLavado(enLavadoCount)
      setCanastillasEnRetorno(enRetornoCount)

      // 4. Filtrar canastillas para lotes (solo las NO retenidas, con status DISPONIBLE)
      const canastillasParaLotes = canastillasStatusDisponible.filter(c =>
        !canastillasRetenidas.includes(c.id)
      )

      // 5. Obtener canastillas dadas de baja (solo para super_admin)
      let bajas: any[] = []
      if (isSuperAdmin) {
        const { data: bajasData, error: bajasErr } = await supabase
          .from('canastillas_bajas')
          .select('*')

        if (bajasErr) throw bajasErr
        bajas = bajasData || []
      }

      // 6. Agrupar por: estado + color + tamaño + forma + condición + tipo_propiedad
      //    Se incluyen TODAS las canastillas (no solo las disponibles)
      const lotesMap = new Map<string, LoteItem>()

      // PRIMERO: Procesar TODAS las canastillas con su estado real
      todasLasCanastillas.forEach((c) => {
        const key = `${c.status}|${c.color}|${c.size}|${c.shape || 'SIN_FORMA'}|${c.condition || 'SIN_CONDICION'}|${c.tipo_propiedad}`

        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            id: key,
            color: c.color,
            size: c.size,
            shape: c.shape || undefined,
            condition: c.condition || undefined,
            tipoPropiedad: c.tipo_propiedad,
            estado: c.status,
            cantidad: 0,
            canastillas: [],
          })
        }

        const lote = lotesMap.get(key)!
        lote.cantidad += 1
        lote.canastillas.push(c.codigo)
      })

      // SEGUNDO: Procesar canastillas en baja
      bajas?.forEach((b) => {
        const estado = 'DADA_DE_BAJA'
        const key = `${b.color}|${b.size}|${b.shape || 'SIN_FORMA'}|${b.condition || 'SIN_CONDICION'}|${b.tipo_propiedad}|${estado}`

        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            id: key,
            color: b.color,
            size: b.size,
            shape: b.shape || undefined,
            condition: b.condition || undefined,
            tipoPropiedad: b.tipo_propiedad,
            estado: estado,
            cantidad: 0,
            canastillas: [],
          })
        }

        const lote = lotesMap.get(key)!
        lote.cantidad += 1
        lote.canastillas.push(b.codigo)
      })

      // Convertir a array y ordenar
      const estadoOrden: Record<string, number> = {
        'DISPONIBLE': 0, 'EN_ALQUILER': 1, 'EN_RETORNO': 2, 'EN_LAVADO': 3,
        'EN_USO_INTERNO': 4, 'EN_REPARACION': 5,
        'FUERA_SERVICIO': 6, 'EXTRAVIADA': 7, 'DADA_DE_BAJA': 8,
      }
      let lotesArray: LoteItem[] = Array.from(lotesMap.values()).sort((a, b) => {
        // Primero por estado
        const eA = estadoOrden[a.estado] ?? 99
        const eB = estadoOrden[b.estado] ?? 99
        if (eA !== eB) return eA - eB
        // Luego por tipo de propiedad
        if (a.tipoPropiedad !== b.tipoPropiedad) {
          return a.tipoPropiedad === 'PROPIA' ? -1 : 1
        }
        // Luego por color
        if (a.color !== b.color) {
          return a.color.localeCompare(b.color)
        }
        // Luego por tamaño
        if (a.size !== b.size) {
          return a.size.localeCompare(b.size)
        }
        // Finalmente por cantidad (mayor primero)
        return b.cantidad - a.cantidad
      })

      setLotes(lotesArray)
      setCurrentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario')
      console.error('Error cargando inventario:', err)
    } finally {
      setLoading(false)
    }
  }

  const recibirCanastillasEnRetorno = async () => {
    if (!user) return
    try {
      setRecibiendoRetorno(true)
      setError(null)

      // Obtener IDs de canastillas EN_RETORNO del usuario actual
      const { data: canastillasRetorno, error: fetchErr } = await supabase
        .from('canastillas')
        .select('id')
        .eq('status', 'EN_RETORNO')
        .eq('current_owner_id', user.id)

      if (fetchErr) throw fetchErr
      if (!canastillasRetorno || canastillasRetorno.length === 0) {
        setError('No hay canastillas en retorno para recibir')
        return
      }

      const ids = canastillasRetorno.map(c => c.id)
      const BATCH_SIZE = 50
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE)
        const { error: updateErr } = await supabase
          .from('canastillas')
          .update({ status: 'DISPONIBLE', current_location: 'CANASTILLERO' })
          .in('id', batch)
        if (updateErr) throw updateErr
      }

      await cargarInventario()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al recibir canastillas')
      console.error('Error recibiendo retorno:', err)
    } finally {
      setRecibiendoRetorno(false)
    }
  }

  const getEstadoLabel = (estado: string): string => {
    const labels: Record<string, string> = {
      'DISPONIBLE': '✅ Disponible',
      'EN_ALQUILER': '🔄 En Alquiler',
      'EN_RETORNO': '🚛 En Retorno',
      'EN_LAVADO': '🧼 En Lavado',
      'EN_USO_INTERNO': '🏢 Uso Interno',
      'EN_REPARACION': '🔧 Reparación',
      'FUERA_SERVICIO': '⛔ Fuera Servicio',
      'EXTRAVIADA': '❓ Extraviada',
      'DADA_DE_BAJA': '🗑️ Destrucción',
    }
    return labels[estado] || estado
  }

  const getEstadoColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'DISPONIBLE': 'bg-green-50 border-green-200',
      'EN_ALQUILER': 'bg-purple-50 border-purple-200',
      'EN_RETORNO': 'bg-amber-50 border-amber-200',
      'EN_LAVADO': 'bg-cyan-50 border-cyan-200',
      'EN_USO_INTERNO': 'bg-yellow-50 border-yellow-200',
      'EN_REPARACION': 'bg-orange-50 border-orange-200',
      'FUERA_SERVICIO': 'bg-red-50 border-red-200',
      'EXTRAVIADA': 'bg-red-100 border-red-300',
      'DADA_DE_BAJA': 'bg-gray-300 border-gray-500',
    }
    return colors[estado] || 'bg-gray-50 border-gray-200'
  }

  const getTipoLabel = (tipo: string): string => {
    return tipo === 'PROPIA' ? '🏢 Propia' : '🔄 Alquilada'
  }

  const getTipoColor = (tipo: string): string => {
    return tipo === 'PROPIA' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
  }

  // CALCULAR ESTADÍSTICAS DE LOTES
  const totalEnLotes = lotes
    .filter(l => l.estado !== 'DADA_DE_BAJA')
    .reduce((sum, l) => sum + l.cantidad, 0)
  const enDestruccion = lotes
    .filter(l => l.estado === 'DADA_DE_BAJA')
    .reduce((sum, l) => sum + l.cantidad, 0)

  const totalPages = Math.ceil(lotes.length / itemsPerPage)

  if (loading) return <LoadingSpinner />

  // ========== VISTA CONSULTOR PROCESO ==========
  if (isConsultorProceso) {
    const STATUS_LABELS: Record<string, string> = {
      DISPONIBLE: '✅ Disponible', EN_ALQUILER: '🔄 En Alquiler', EN_LAVADO: '🧼 En Lavado',
      EN_USO_INTERNO: '🏢 Uso Interno', EN_REPARACION: '🔧 Reparación', EN_RETORNO: '🚛 En Retorno',
      FUERA_SERVICIO: '⛔ Fuera Servicio', EXTRAVIADA: '❓ Extraviada', DADA_DE_BAJA: '🗑️ Baja',
    }
    const STATUS_COLORS: Record<string, string> = {
      DISPONIBLE: 'bg-green-100 text-green-800', EN_ALQUILER: 'bg-purple-100 text-purple-800',
      EN_LAVADO: 'bg-cyan-100 text-cyan-800', EN_USO_INTERNO: 'bg-yellow-100 text-yellow-800',
      EN_REPARACION: 'bg-orange-100 text-orange-800', EN_RETORNO: 'bg-amber-100 text-amber-800',
      FUERA_SERVICIO: 'bg-red-100 text-red-800', EXTRAVIADA: 'bg-gray-100 text-gray-800',
    }

    const totalGeneral = consultorUsuarios.reduce((sum, u) => sum + u.totalCanastillas, 0)

    // Agrupar usuarios por ubicación
    const porUbicacion: Record<string, ConsultorUsuario[]> = {}
    for (const u of consultorUsuarios) {
      if (!porUbicacion[u.department]) porUbicacion[u.department] = []
      porUbicacion[u.department].push(u)
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Inventario por Ubicación</h1>
          <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
            Consulta el inventario de usuarios en las ubicaciones de proceso
          </p>
        </div>

        {error && (
          <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg border bg-blue-50 border-blue-200 shadow-sm">
            <p className="text-gray-600 text-xs sm:text-sm font-medium">Usuarios</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{consultorUsuarios.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-green-50 border-green-200 shadow-sm">
            <p className="text-gray-600 text-xs sm:text-sm font-medium">Total Canastillas</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalGeneral}</p>
          </div>
          <div className="p-4 rounded-lg border bg-purple-50 border-purple-200 shadow-sm">
            <p className="text-gray-600 text-xs sm:text-sm font-medium">Ubicaciones</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{Object.keys(porUbicacion).length}</p>
          </div>
        </div>

        {/* Lista de usuarios por ubicación */}
        {consultorUsuarios.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No se encontraron usuarios en las ubicaciones de proceso</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(porUbicacion).sort((a, b) => a[0].localeCompare(b[0])).map(([ubicacion, usuarios]) => (
              <div key={ubicacion} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <span>📍</span> {ubicacion}
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs font-bold">
                      {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}
                    </span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
                      {usuarios.reduce((s, u) => s + u.totalCanastillas, 0)} canastillas
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {usuarios.map((u) => (
                    <div key={u.id}>
                      <button
                        onClick={() => {
                          if (consultorSelectedUser?.id === u.id) {
                            setConsultorSelectedUser(null)
                            setConsultorLotes([])
                            setConsultorTraspasos([])
                          } else {
                            setConsultorSelectedUser(u)
                            setConsultorVistaActiva('canastillas')
                            cargarLotesUsuarioConsultor(u.id)
                          }
                        }}
                        className="w-full px-4 sm:px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {u.first_name?.[0]}{u.last_name?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-bold">
                            {u.totalCanastillas}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${consultorSelectedUser?.id === u.id ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Contenido del usuario seleccionado */}
                      {consultorSelectedUser?.id === u.id && (
                        <div className="border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-4">
                          {/* Tabs: Canastillas / Traspasos */}
                          <div className="flex gap-2 mb-4">
                            <button
                              onClick={() => {
                                setConsultorVistaActiva('canastillas')
                                if (consultorLotes.length === 0) cargarLotesUsuarioConsultor(u.id)
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                consultorVistaActiva === 'canastillas'
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              📦 Canastillas
                            </button>
                            <button
                              onClick={() => {
                                setConsultorVistaActiva('traspasos')
                                if (consultorTraspasos.length === 0) cargarTraspasosUsuarioConsultor(u.id)
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                consultorVistaActiva === 'traspasos'
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              🔄 Traspasos
                            </button>
                          </div>

                          {/* Vista Canastillas */}
                          {consultorVistaActiva === 'canastillas' && (
                            <>
                          {consultorLoadingLotes ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                          ) : consultorLotes.length === 0 ? (
                            <p className="text-center text-sm text-gray-500 py-4">Sin canastillas</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                    <th className="pb-2 pr-4">Estado</th>
                                    <th className="pb-2 pr-4">Color</th>
                                    <th className="pb-2 pr-4">Tamaño</th>
                                    <th className="pb-2 pr-4">Forma</th>
                                    <th className="pb-2 pr-4">Tipo</th>
                                    <th className="pb-2 text-center">Cantidad</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {consultorLotes.map((lote) => (
                                    <tr key={lote.key} className="hover:bg-white transition-colors">
                                      <td className="py-2 pr-4">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lote.status] || 'bg-gray-100 text-gray-800'}`}>
                                          {STATUS_LABELS[lote.status] || lote.status}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4">
                                        <div className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: lote.color.toLowerCase().replace(/ /g, '') }} />
                                          <span className="text-gray-900">{lote.color}</span>
                                        </div>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-700">{lote.size}</td>
                                      <td className="py-2 pr-4 text-gray-700">{lote.shape}</td>
                                      <td className="py-2 pr-4">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lote.tipo_propiedad === 'PROPIA' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                          {lote.tipo_propiedad === 'PROPIA' ? '🏢 Propia' : '🔄 Alquilada'}
                                        </span>
                                      </td>
                                      <td className="py-2 text-center">
                                        <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-bold">
                                          {lote.cantidad}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-gray-300 font-semibold">
                                    <td colSpan={5} className="py-2 pr-4 text-gray-900">Total</td>
                                    <td className="py-2 text-center">
                                      <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-sm font-bold">
                                        {consultorLotes.reduce((s, l) => s + l.cantidad, 0)}
                                      </span>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                            </>
                          )}

                          {/* Vista Traspasos */}
                          {consultorVistaActiva === 'traspasos' && (
                            <>
                              {consultorLoadingLotes ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                                </div>
                              ) : consultorTraspasos.length === 0 ? (
                                <p className="text-center text-sm text-gray-500 py-4">Sin traspasos registrados</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                        <th className="pb-2 pr-4">Dirección</th>
                                        <th className="pb-2 pr-4">De / Para</th>
                                        <th className="pb-2 pr-4">Canastillas</th>
                                        <th className="pb-2 pr-4">Fecha</th>
                                        <th className="pb-2 pr-4">Estado</th>
                                        <th className="pb-2 pr-4">Remisión</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {consultorTraspasos.map((t: any) => {
                                        const statusColors: Record<string, string> = {
                                          PENDIENTE: 'bg-yellow-100 text-yellow-800',
                                          ACEPTADO: 'bg-green-100 text-green-800',
                                          RECHAZADO: 'bg-red-100 text-red-800',
                                        }
                                        const count = Array.isArray(t.items_count) ? t.items_count[0]?.count || 0 : t.items_count || 0
                                        const otherUser = t.direccion === 'ENVIADO'
                                          ? t.to_user
                                          : t.from_user
                                        return (
                                          <tr key={`${t.id}-${t.direccion}`} className="hover:bg-white transition-colors">
                                            <td className="py-2 pr-4">
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                t.direccion === 'ENVIADO' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'
                                              }`}>
                                                {t.direccion === 'ENVIADO' ? '📤 Enviado' : '📥 Recibido'}
                                              </span>
                                            </td>
                                            <td className="py-2 pr-4 text-gray-900">
                                              {otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : '—'}
                                            </td>
                                            <td className="py-2 pr-4 text-center">
                                              <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                {count}
                                              </span>
                                            </td>
                                            <td className="py-2 pr-4 text-gray-700 text-xs">
                                              {new Date(t.requested_at).toLocaleString('es-CO', {
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                              })}
                                            </td>
                                            <td className="py-2 pr-4">
                                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] || 'bg-gray-100 text-gray-800'}`}>
                                                {t.status}
                                              </span>
                                            </td>
                                            <td className="py-2 pr-4 text-xs text-purple-600 font-medium">
                                              {t.remision_number || '—'}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ========== VISTA NORMAL ==========
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
          {isSuperAdmin ? 'Inventario General' : 'Mi Inventario'}
        </h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
          {isSuperAdmin
            ? 'Todas las canastillas del sistema'
            : 'Tus canastillas agrupadas por características'
          }
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${isSuperAdmin ? 'xl:grid-cols-6' : 'lg:grid-cols-5'} gap-3 sm:gap-4`}>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <div>
            <p className="text-sm font-medium text-white/80">Total</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{totalCanastillas}</p>
            <p className="text-xs text-white/60 mt-1 hidden sm:block">En tu inventario</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <div>
            <p className="text-sm font-medium text-white/80">Disponibles</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{canastillasDisponibles}</p>
            <p className="text-xs text-white/60 mt-1 hidden sm:block">Libres para usar</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <div>
            <p className="text-sm font-medium text-white/80">En Traspaso</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{canastillasEnTraspaso}</p>
            <p className="text-xs text-white/60 mt-1 hidden sm:block">Pendientes</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 dark:from-cyan-600 dark:to-cyan-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <div>
            <p className="text-sm font-medium text-white/80">En Lavado</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{canastillasEnLavado}</p>
            <p className="text-xs text-white/60 mt-1 hidden sm:block">En proceso</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
          <div>
            <p className="text-sm font-medium text-white/80">En Retorno</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{canastillasEnRetorno}</p>
            {canastillasEnRetorno > 0 && (
              <button
                onClick={recibirCanastillasEnRetorno}
                disabled={recibiendoRetorno}
                className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors backdrop-blur-sm"
              >
                {recibiendoRetorno ? 'Recibiendo...' : `Recibir (${canastillasEnRetorno})`}
              </button>
            )}
          </div>
        </div>
        {isSuperAdmin && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 col-span-2 xl:col-span-1">
            <div>
              <p className="text-sm font-medium text-white/80">Destrucción</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">{enDestruccion}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Lotes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Canastillas por Lote</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {lotes.length} lotes ({totalEnLotes} canastillas)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Color</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Tamaño</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Forma</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Condición</th>
                <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lotesPaginados.length > 0 ? (
                lotesPaginados.map((lote) => (
                  <tr key={lote.id} className={`transition-colors hover:opacity-90 ${getEstadoColor(lote.estado)}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-800">
                        {getEstadoLabel(lote.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTipoColor(lote.tipoPropiedad)}`}>
                        {getTipoLabel(lote.tipoPropiedad)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: lote.color.toLowerCase().replace(/ /g, ''),
                          }}
                        />
                        <span className="text-sm font-medium text-gray-900">{lote.color}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.size}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.shape || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.condition || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-white bg-opacity-70 text-gray-800">
                        {lote.cantidad}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="font-medium">No hay lotes para mostrar</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col items-center gap-3">
          <div className="text-xs sm:text-sm text-gray-600 text-center">
            {lotesPaginados.length === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + 1, lotes.length)}-
            {Math.min(currentPage * itemsPerPage, lotes.length)} de {lotes.length} lotes
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
              >
                <span className="hidden sm:inline">← Anterior</span>
                <span className="sm:hidden">←</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  )
                  .map((page, idx, arr) => {
                    if (idx > 0 && arr[idx - 1] !== page - 1) {
                      return (
                        <span key={`dots-${page}`} className="px-1 sm:px-2 text-gray-500 text-xs">
                          ...
                        </span>
                      )
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium ${
                          currentPage === page
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
              >
                <span className="hidden sm:inline">Siguiente →</span>
                <span className="sm:hidden">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}