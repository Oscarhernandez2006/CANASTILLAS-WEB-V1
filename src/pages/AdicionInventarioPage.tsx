/** @module AdicionInventarioPage @description Adición de canastillas existentes o creación de nuevas al inventario de cualquier usuario. Solo para administradores. */
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { SearchableUserSelect } from '@/components/SearchableUserSelect'
import { DynamicSelect } from '@/components/DynamicSelect'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import { logAuditEvent } from '@/services/auditService'
import type { User, Canastilla, TipoPropiedad } from '@/types'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  condition: string
  tipo_propiedad: string
  propietarioActual: string
  propietarioNombre: string
  totalDisponible: number
  cantidadAgregar: number
  canastillas: Canastilla[]
}

export function AdicionInventarioPage() {
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [historial, setHistorial] = useState<{ fecha: string; usuario: string; cantidad: number }[]>([])

  // Modo: existentes (traspasar del inventario propio) o crear (crear nuevas directamente)
  const [modo, setModo] = useState<'existentes' | 'crear'>('crear')

  // Atributos dinámicos para modo crear
  const colores = useCanastillaAttributes('COLOR')
  const tamaños = useCanastillaAttributes('SIZE')
  const formas = useCanastillaAttributes('FORMA')
  const condiciones = useCanastillaAttributes('CONDICION')

  const [crearForm, setCrearForm] = useState({
    cantidad: '1',
    size: '',
    color: '',
    shape: '',
    condition: 'Bueno',
    tipo_propiedad: 'PROPIA' as TipoPropiedad,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (selectedUserId && modo === 'existentes') {
      fetchCanastillasYAgrupar()
    } else {
      setLotes([])
    }
  }, [selectedUserId, modo])

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, department, area, role, is_active')
        .eq('is_active', true)
        .order('first_name')

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchCanastillasYAgrupar = async () => {
    if (!selectedUserId || !currentUser) return

    setLoadingLotes(true)
    setError('')

    try {
      // Obtener canastillas DISPONIBLE del inventario personal del admin logueado
      const PAGE_SIZE = 1000
      let disponibles: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: errorDisponibles } = await supabase
          .from('canastillas')
          .select('id, codigo, size, color, shape, condition, tipo_propiedad, status')
          .eq('status', 'DISPONIBLE')
          .eq('current_owner_id', currentUser.id)
          .order('color', { ascending: true })
          .order('id', { ascending: true })
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

      // Agrupar por size + color + shape + condition + tipo_propiedad
      const grouped: Record<string, LoteGroup> = {}
      const ownerName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()

      for (const canastilla of disponibles) {
        const key = `${canastilla.size}-${canastilla.color}-${canastilla.shape || ''}-${canastilla.condition || ''}-${canastilla.tipo_propiedad || 'PROPIA'}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: canastilla.size,
            color: canastilla.color,
            shape: canastilla.shape || '',
            condition: canastilla.condition || '',
            tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
            propietarioActual: currentUser.id,
            propietarioNombre: ownerName,
            totalDisponible: 0,
            cantidadAgregar: 0,
            canastillas: [],
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(canastilla)
      }

      // Ordenar por tamaño y color
      const sortedLotes = Object.values(grouped).sort((a, b) => {
        const sizeCompare = a.size.localeCompare(b.size)
        if (sizeCompare !== 0) return sizeCompare
        return a.color.localeCompare(b.color)
      })

      setLotes(sortedLotes)
    } catch (err: unknown) {
      console.error('Error fetching canastillas:', err)
      setError('Error al cargar las canastillas: ' + (err as Error).message)
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

  const handleAgregarTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadAgregar: lote.totalDisponible }
          : lote
      )
    )
  }

  const handleAgregarTodoGlobal = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadAgregar: lote.totalDisponible }))
    )
  }

  const handleLimpiarTodo = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadAgregar: 0 }))
    )
  }

  const totalCanastillasAgregar = lotes.reduce((sum, lote) => sum + lote.cantidadAgregar, 0)
  const totalCanastillasDisponibles = lotes.reduce((sum, lote) => sum + lote.totalDisponible, 0)

  const handlePreSubmit = () => {
    setError('')
    if (!selectedUserId) { setError('Seleccione un usuario destino'); return }
    if (totalCanastillasAgregar === 0) { setError('Seleccione al menos una canastilla'); return }
    setShowConfirmation(true)
  }

  const handleConfirm = async () => {
    if (!currentUser) return
    setShowConfirmation(false)
    setLoading(true)
    setProgress(0)
    setError('')
    setSuccess('')

    try {
      const destinoUser = users.find(u => u.id === selectedUserId)
      if (!destinoUser) throw new Error('Usuario destino no encontrado')

      // Recopilar los IDs de las canastillas seleccionadas
      const canastillaIds: string[] = []
      for (const lote of lotes) {
        if (lote.cantidadAgregar > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadAgregar)
          canastillaIds.push(...seleccionadas.map(c => c.id))
        }
      }

      if (canastillaIds.length === 0) throw new Error('No hay canastillas seleccionadas')

      // Actualizar en lotes de 500
      const BATCH_SIZE = 500
      let actualizados = 0

      for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
        const batch = canastillaIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({ current_owner_id: selectedUserId })
          .in('id', batch)

        if (updateError) throw new Error(`Error al asignar canastillas: ${updateError.message}`)

        actualizados += batch.length
        setProgress(Math.round((actualizados / canastillaIds.length) * 100))
      }

      // Registrar en auditoría
      const userName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      const destinoNombre = `${destinoUser.first_name || ''} ${destinoUser.last_name || ''}`.trim()

      const detalleLotes = lotes
        .filter(l => l.cantidadAgregar > 0)
        .map(l => ({
          tamaño: l.size,
          color: l.color,
          forma: l.shape || 'N/A',
          condición: l.condition || 'N/A',
          tipo_propiedad: l.tipo_propiedad,
          propietario_anterior: l.propietarioNombre,
          cantidad: l.cantidadAgregar,
        }))

      await logAuditEvent({
        userId: currentUser.id,
        userName,
        userRole: currentUser.role,
        action: 'UPDATE',
        module: 'adicion_inventario',
        description: `Cargue de ${canastillaIds.length} canastilla(s) al inventario de ${destinoNombre}`,
        details: {
          usuario_destino_id: selectedUserId,
          usuario_destino_nombre: destinoNombre,
          total_canastillas: canastillaIds.length,
          lotes: detalleLotes,
        },
      })

      setSuccess(`Se cargaron ${canastillaIds.length} canastilla(s) al inventario de ${destinoNombre}`)
      setHistorial(prev => [{
        fecha: new Date().toLocaleString('es-CO'),
        usuario: destinoNombre,
        cantidad: canastillaIds.length,
      }, ...prev])
      setLotes([])
      setSelectedUserId('')
    } catch (err) {
      setError((err as Error).message || 'Error al asignar canastillas')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId)
  const lotesConSeleccion = lotes.filter(l => l.cantidadAgregar > 0)

  // Función para generar código único
  const generarCodigoUnico = (index: number) => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 6)
    const indexStr = index.toString(36).padStart(4, '0')
    return `C${timestamp}${indexStr}${random}`.toUpperCase()
  }

  const cantidadCrear = Math.max(1, parseInt(crearForm.cantidad) || 1)

  const handleCrearNuevas = async () => {
    if (!currentUser || !selectedUserId) return
    setLoading(true)
    setProgress(0)
    setError('')
    setSuccess('')

    try {
      const destinoUser = users.find(u => u.id === selectedUserId)
      if (!destinoUser) throw new Error('Usuario destino no encontrado')

      if (!crearForm.size?.trim()) throw new Error('El tamaño es requerido')
      if (!crearForm.color?.trim()) throw new Error('El color es requerido')

      const cantidadNum = Math.max(1, parseInt(crearForm.cantidad) || 1)
      if (cantidadNum < 1 || cantidadNum > 10000) throw new Error('La cantidad debe estar entre 1 y 10,000')

      const destinoNombre = `${destinoUser.first_name || ''} ${destinoUser.last_name || ''}`.trim()

      // Crear canastillas con ubicación = nombre del usuario destino
      const canastillas = []
      for (let i = 0; i < cantidadNum; i++) {
        const codigo = generarCodigoUnico(i)
        canastillas.push({
          codigo,
          qr_code: codigo,
          size: crearForm.size,
          color: crearForm.color,
          shape: crearForm.shape || null,
          status: 'DISPONIBLE',
          condition: crearForm.condition,
          current_location: destinoNombre,
          current_area: null,
          current_owner_id: currentUser.id,
          tipo_propiedad: crearForm.tipo_propiedad,
        })
      }

      // Insertar en lotes de 500 (con owner del admin actual para pasar RLS)
      const BATCH_SIZE = 500
      let insertados = 0
      const allInsertedIds: string[] = []

      for (let i = 0; i < canastillas.length; i += BATCH_SIZE) {
        const batch = canastillas.slice(i, i + BATCH_SIZE)
        const { data: inserted, error: insertError } = await supabase
          .from('canastillas')
          .insert(batch)
          .select('id')
        if (insertError) throw new Error(`Error al crear canastillas: ${insertError.message}`)

        if (inserted) allInsertedIds.push(...inserted.map((r: any) => r.id))
        insertados += batch.length
        setProgress(Math.round((insertados / canastillas.length) * 50))
      }

      // Reasignar al usuario destino en lotes
      let reasignados = 0
      for (let i = 0; i < allInsertedIds.length; i += BATCH_SIZE) {
        const batch = allInsertedIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({ current_owner_id: selectedUserId })
          .in('id', batch)
        if (updateError) throw new Error(`Error al asignar canastillas al usuario: ${updateError.message}`)

        reasignados += batch.length
        setProgress(50 + Math.round((reasignados / allInsertedIds.length) * 50))
      }

      // Registrar en auditoría
      const userName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      await logAuditEvent({
        userId: currentUser.id,
        userName,
        userRole: currentUser.role,
        action: 'CREATE',
        module: 'adicion_inventario',
        description: `Creación de ${cantidadNum} canastilla(s) nuevas para ${destinoNombre}`,
        details: {
          usuario_destino_id: selectedUserId,
          usuario_destino_nombre: destinoNombre,
          total_canastillas: cantidadNum,
          tamaño: crearForm.size,
          color: crearForm.color,
          forma: crearForm.shape,
          condición: crearForm.condition,
          tipo_propiedad: crearForm.tipo_propiedad,
          ubicación: destinoNombre,
        },
      })

      setSuccess(`Se crearon ${cantidadNum} canastilla(s) en el inventario de ${destinoNombre}`)
      setHistorial(prev => [{
        fecha: new Date().toLocaleString('es-CO'),
        usuario: destinoNombre,
        cantidad: cantidadNum,
      }, ...prev])
      setSelectedUserId('')
      setCrearForm({ cantidad: '1', size: '', color: '', shape: '', condition: 'Bueno', tipo_propiedad: 'PROPIA' })
    } catch (err) {
      setError((err as Error).message || 'Error al crear canastillas')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <DashboardLayout title="Cargue a Inventario" subtitle="Crear o asignar canastillas al inventario de un usuario">
      <div className="space-y-6">

        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">
              <strong>Crear nuevas:</strong> Crea canastillas directamente en el inventario del usuario con su ubicación.
              <strong className="ml-2">Existentes:</strong> Transfiere canastillas de su inventario personal al usuario destino.
              Todos los movimientos quedan registrados en el log de auditoría.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-2">{success}</h3>
            <button onClick={() => setSuccess('')} className="mt-2 text-green-600 hover:text-green-800 underline text-sm">
              Realizar otro cargue
            </button>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg">
            <p className="text-sm font-semibold">Asignando canastillas...</p>
            <div className="mt-2 bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs mt-1">{progress}% completado</p>
          </div>
        )}

        {!success && !loading && (
          <>
            {/* Paso 1: Seleccionar usuario */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="bg-primary-600 px-6 py-4 rounded-t-xl">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="bg-white text-primary-600 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Seleccionar Usuario Destino
                </h2>
              </div>
              <div className="p-6 min-h-[120px]">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <SearchableUserSelect
                    users={users}
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    placeholder="Buscar usuario por nombre, email o cédula..."
                    renderBadge={(u: { role?: string }) => (
                      <span className="text-xs text-gray-500 ml-1">({u.role})</span>
                    )}
                  />
                )}
                {selectedUser && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <p className="text-sm text-primary-800">
                      <strong>Destino:</strong> {selectedUser.first_name} {selectedUser.last_name}
                      <span className="text-primary-600 ml-2">({selectedUser.email})</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle de modo */}
            {selectedUserId && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Modo:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setModo('crear')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        modo === 'crear'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Crear Nuevas
                    </button>
                    <button
                      type="button"
                      onClick={() => setModo('existentes')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        modo === 'existentes'
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Desde Mi Inventario
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modo CREAR: Formulario para crear canastillas nuevas */}
            {selectedUserId && modo === 'crear' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-primary-600 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="bg-white text-primary-600 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Crear Canastillas Nuevas para {selectedUser?.first_name} {selectedUser?.last_name}
                  </h2>
                </div>
                <div className="p-6">
                  <div className="bg-green-50 border-l-4 border-green-400 p-3 mb-4">
                    <p className="text-sm text-green-700">
                      Las canastillas se crearán directamente en el inventario de <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong> con ubicación a su nombre.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cantidad */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={crearForm.cantidad}
                        onChange={(e) => setCrearForm({ ...crearForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    {/* Tamaño */}
                    <DynamicSelect
                      label="Tamaño"
                      value={crearForm.size}
                      options={tamaños.attributes}
                      onChange={(value) => setCrearForm({ ...crearForm, size: value })}
                      onAddNew={tamaños.addAttribute}
                      required
                      placeholder="Seleccionar tamaño..."
                    />

                    {/* Color */}
                    <DynamicSelect
                      label="Color"
                      value={crearForm.color}
                      options={colores.attributes}
                      onChange={(value) => setCrearForm({ ...crearForm, color: value })}
                      onAddNew={colores.addAttribute}
                      required
                      placeholder="Seleccionar color..."
                    />

                    {/* Forma */}
                    <DynamicSelect
                      label="Forma"
                      value={crearForm.shape}
                      options={formas.attributes}
                      onChange={(value) => setCrearForm({ ...crearForm, shape: value })}
                      onAddNew={formas.addAttribute}
                      placeholder="Seleccionar forma..."
                    />

                    {/* Condición */}
                    <DynamicSelect
                      label="Condición"
                      value={crearForm.condition}
                      options={condiciones.attributes}
                      onChange={(value) => setCrearForm({ ...crearForm, condition: value })}
                      onAddNew={condiciones.addAttribute}
                      required
                      placeholder="Seleccionar condición..."
                    />

                    {/* Tipo de Propiedad */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Propiedad <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={crearForm.tipo_propiedad}
                        onChange={(e) => setCrearForm({ ...crearForm, tipo_propiedad: e.target.value as TipoPropiedad })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="PROPIA">Propia</option>
                        <option value="ALQUILADA">Alquilada</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleCrearNuevas}
                      disabled={loading || !crearForm.size || !crearForm.color || !selectedUserId}
                    >
                      Crear {cantidadCrear} Canastilla(s) para {selectedUser?.first_name}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Modo EXISTENTES: Paso 2 - Seleccionar canastillas por lotes */}
            {selectedUserId && modo === 'existentes' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-primary-600 px-6 py-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="bg-white text-primary-600 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Seleccionar Canastillas por Lote
                  </h2>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Canastillas disponibles para asignar
                    </h4>
                    {!loadingLotes && lotes.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAgregarTodoGlobal}
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
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={fetchCanastillasYAgrupar}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Recargar
                        </button>
                      </div>
                    )}
                  </div>

                  {loadingLotes ? (
                    <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Cargando canastillas disponibles...</p>
                      </div>
                    </div>
                  ) : lotes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-sm text-gray-500">No hay canastillas disponibles para asignar a este usuario</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                        <div className="col-span-4">Lote</div>
                        <div className="col-span-2">Propietario</div>
                        <div className="col-span-2 text-center">Disponibles</div>
                        <div className="col-span-2 text-center">Agregar</div>
                        <div className="col-span-2 text-center">Acción</div>
                      </div>

                      {/* Filas de lotes */}
                      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {lotes.map((lote) => (
                          <div key={lote.key} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 ${lote.cantidadAgregar > 0 ? 'bg-primary-50/50' : ''}`}>
                            <div className="col-span-4 flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: lote.color.toLowerCase().replace(/ /g, '') }}
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {lote.size} · {lote.color}
                                </p>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  {lote.shape && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{lote.shape}</span>
                                  )}
                                  {lote.condition && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{lote.condition}</span>
                                  )}
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    lote.tipo_propiedad === 'PROPIA' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {lote.tipo_propiedad === 'PROPIA' ? 'Propia' : 'Alquilada'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs text-gray-600 truncate" title={lote.propietarioNombre}>
                                {lote.propietarioNombre}
                              </p>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="text-sm font-semibold text-gray-700">
                                {lote.totalDisponible}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="0"
                                max={lote.totalDisponible}
                                value={lote.cantidadAgregar || ''}
                                onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                              />
                            </div>
                            <div className="col-span-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleAgregarTodo(lote.key)}
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
                        <div className="col-span-4 text-sm font-semibold text-gray-900">TOTAL</div>
                        <div className="col-span-2"></div>
                        <div className="col-span-2 text-center text-sm font-semibold text-gray-700">
                          {totalCanastillasDisponibles}
                        </div>
                        <div className="col-span-2 text-center text-sm font-bold text-primary-600">
                          {totalCanastillasAgregar}
                        </div>
                        <div className="col-span-2"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botón de envío */}
            {totalCanastillasAgregar > 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={handlePreSubmit}
                  disabled={loading || totalCanastillasAgregar === 0 || !selectedUserId}
                >
                  Cargar {totalCanastillasAgregar} Canastilla(s) al Inventario
                </Button>
              </div>
            )}
          </>
        )}

        {/* Historial de sesión */}
        {historial.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Cargues realizados en esta sesión</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {historial.map((h, idx) => (
                <div key={idx} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.usuario}</p>
                      <p className="text-xs text-gray-500">{h.fecha}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    +{h.cantidad} canastillas
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowConfirmation(false)}></div>
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Cargue a Inventario</h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  <strong>Usuario destino:</strong> {selectedUser?.first_name} {selectedUser?.last_name}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {lotesConSeleccion.map((lote) => (
                    <div key={lote.key} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {lote.size} · {lote.color} {lote.shape ? `· ${lote.shape}` : ''}
                        <span className="text-gray-400 ml-1">(de {lote.propietarioNombre})</span>
                      </span>
                      <span className="font-semibold">{lote.cantidadAgregar}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">{totalCanastillasAgregar}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-amber-600 mb-4">
                ⚠️ Esta acción reasignará las canastillas seleccionadas al usuario destino. Queda registrada en auditoría.
              </p>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirm}>
                  Confirmar Cargue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
