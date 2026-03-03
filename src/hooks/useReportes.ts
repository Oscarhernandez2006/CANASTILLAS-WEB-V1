import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { 
  ReporteIngresos, 
  ReporteCanastillaMasAlquilada, 
  ReporteClienteFrecuente,
  ReporteInventario,
  IngresosDiarios
} from '@/types'

export function useReportes() {
  const [loading, setLoading] = useState(false)

  // Reporte de ingresos por período
  const getReporteIngresos = async (
    fechaInicio: string, 
    fechaFin: string
  ): Promise<ReporteIngresos | null> => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('rentals')
        .select('*, rental_items(*)')
        .eq('status', 'RETORNADO')
        .gte('actual_return_date', fechaInicio)
        .lte('actual_return_date', fechaFin)

      if (error) throw error

      if (!data || data.length === 0) {
        return {
          periodo: `${fechaInicio} - ${fechaFin}`,
          total_ingresos: 0,
          total_alquileres: 0,
          promedio_por_alquiler: 0,
          canastillas_alquiladas: 0,
          dias_promedio: 0,
        }
      }

      const totalIngresos = data.reduce((sum, r) => sum + (r.total_amount || 0), 0)
      const totalAlquileres = data.length
      const totalCanastillas = data.reduce((sum, r) => sum + (r.rental_items?.length || 0), 0)
      const totalDias = data.reduce((sum, r) => sum + (r.actual_days || 0), 0)

      return {
        periodo: `${fechaInicio} - ${fechaFin}`,
        total_ingresos: totalIngresos,
        total_alquileres: totalAlquileres,
        promedio_por_alquiler: totalIngresos / totalAlquileres,
        canastillas_alquiladas: totalCanastillas,
        dias_promedio: totalDias / totalAlquileres,
      }
    } catch (error) {
      console.error('Error getting reporte ingresos:', error)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Ingresos diarios
  const getIngresosDiarios = async (
    fechaInicio: string,
    fechaFin: string
  ): Promise<IngresosDiarios[]> => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select('actual_return_date, total_amount')
        .eq('status', 'RETORNADO')
        .gte('actual_return_date', fechaInicio)
        .lte('actual_return_date', fechaFin)
        .order('actual_return_date')

      if (error) throw error
      if (!data) return []

      // Agrupar por fecha
      const groupedByDate: { [key: string]: { ingresos: number; alquileres: number } } = {}

      data.forEach((rental) => {
        const fecha = new Date(rental.actual_return_date).toLocaleDateString('es-CO')
        if (!groupedByDate[fecha]) {
          groupedByDate[fecha] = { ingresos: 0, alquileres: 0 }
        }
        groupedByDate[fecha].ingresos += rental.total_amount || 0
        groupedByDate[fecha].alquileres += 1
      })

      return Object.entries(groupedByDate).map(([fecha, data]) => ({
        fecha,
        ingresos: data.ingresos,
        alquileres: data.alquileres,
      }))
    } catch (error) {
      console.error('Error getting ingresos diarios:', error)
      return []
    }
  }

  // Canastillas más alquiladas
  const getCanastillasMasAlquiladas = async (
    fechaInicio: string,
    fechaFin: string,
    limit: number = 10
  ): Promise<ReporteCanastillaMasAlquilada[]> => {
    try {
      const { data, error } = await supabase
        .from('rental_items')
        .select(`
          canastilla_id,
          canastilla:canastillas(id, codigo, size, color),
          rental:rentals!inner(status, actual_return_date, actual_days, total_amount, rental_items(*))
        `)
        .eq('rental.status', 'RETORNADO')
        .gte('rental.actual_return_date', fechaInicio)
        .lte('rental.actual_return_date', fechaFin)

      if (error) throw error
      if (!data) return []

      // Agrupar por canastilla
      const groupedByCanastilla: { [key: string]: any } = {}

      data.forEach((item: any) => {
        const canastillaId = item.canastilla_id
        if (!groupedByCanastilla[canastillaId]) {
          groupedByCanastilla[canastillaId] = {
            canastilla_id: canastillaId,
            codigo: item.canastilla.codigo,
            size: item.canastilla.size,
            color: item.canastilla.color,
            total_alquileres: 0,
            dias_totales: 0,
            ingresos_generados: 0,
          }
        }
        groupedByCanastilla[canastillaId].total_alquileres += 1
        groupedByCanastilla[canastillaId].dias_totales += item.rental.actual_days || 0
        
        // Calcular ingreso proporcional
        const canastillasEnRental = item.rental.rental_items?.length || 1
        const ingresoProporcion = (item.rental.total_amount || 0) / canastillasEnRental
        groupedByCanastilla[canastillaId].ingresos_generados += ingresoProporcion
      })

      // Convertir a array y ordenar
      return Object.values(groupedByCanastilla)
        .sort((a: any, b: any) => b.total_alquileres - a.total_alquileres)
        .slice(0, limit)
    } catch (error) {
      console.error('Error getting canastillas más alquiladas:', error)
      return []
    }
  }

  // Clientes frecuentes
  const getClientesFrecuentes = async (
    fechaInicio: string,
    fechaFin: string,
    limit: number = 10
  ): Promise<ReporteClienteFrecuente[]> => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          sale_point_id,
          sale_point:sale_points(name),
          actual_return_date,
          actual_days,
          total_amount,
          rental_items(*)
        `)
        .eq('status', 'RETORNADO')
        .gte('actual_return_date', fechaInicio)
        .lte('actual_return_date', fechaFin)

      if (error) throw error
      if (!data) return []

      // Agrupar por cliente
      const groupedByClient: { [key: string]: any } = {}

      data.forEach((rental: any) => {
        const clientId = rental.sale_point_id
        if (!groupedByClient[clientId]) {
          groupedByClient[clientId] = {
            sale_point_id: clientId,
            nombre: rental.sale_point?.name || 'N/A',
            total_alquileres: 0,
            total_canastillas: 0,
            total_dias: 0,
            total_ingresos: 0,
            ultimo_alquiler: rental.actual_return_date,
          }
        }
        groupedByClient[clientId].total_alquileres += 1
        groupedByClient[clientId].total_canastillas += rental.rental_items?.length || 0
        groupedByClient[clientId].total_dias += rental.actual_days || 0
        groupedByClient[clientId].total_ingresos += rental.total_amount || 0
        
        // Actualizar último alquiler si es más reciente
        if (new Date(rental.actual_return_date) > new Date(groupedByClient[clientId].ultimo_alquiler)) {
          groupedByClient[clientId].ultimo_alquiler = rental.actual_return_date
        }
      })

      // Convertir a array y ordenar
      return Object.values(groupedByClient)
        .sort((a: any, b: any) => b.total_ingresos - a.total_ingresos)
        .slice(0, limit)
    } catch (error) {
      console.error('Error getting clientes frecuentes:', error)
      return []
    }
  }

  // Reporte de inventario - usa consultas de conteo para manejar más de 1000 canastillas
  const getReporteInventario = async (): Promise<ReporteInventario | null> => {
    try {
      // Usar consultas de conteo en paralelo para cada estado
      const [
        totalResult,
        disponiblesResult,
        enAlquilerResult,
        danadasResult,
        enMantenimientoResult,
        perdidasResult,
      ] = await Promise.all([
        supabase.from('canastillas').select('*', { count: 'exact', head: true }),
        supabase.from('canastillas').select('*', { count: 'exact', head: true }).eq('status', 'DISPONIBLE'),
        supabase.from('canastillas').select('*', { count: 'exact', head: true }).eq('status', 'EN_ALQUILER'),
        supabase.from('canastillas').select('*', { count: 'exact', head: true }).eq('status', 'DAÑADA'),
        supabase.from('canastillas').select('*', { count: 'exact', head: true }).eq('status', 'EN_MANTENIMIENTO'),
        supabase.from('canastillas').select('*', { count: 'exact', head: true }).eq('status', 'PERDIDA'),
      ])

      if (totalResult.error) throw totalResult.error

      const total = totalResult.count || 0
      const disponibles = disponiblesResult.count || 0
      const enAlquiler = enAlquilerResult.count || 0
      const danadas = danadasResult.count || 0
      const enMantenimiento = enMantenimientoResult.count || 0
      const perdidas = perdidasResult.count || 0

      return {
        total_canastillas: total,
        disponibles,
        en_alquiler: enAlquiler,
        danadas,
        en_mantenimiento: enMantenimiento,
        perdidas,
        tasa_ocupacion: total > 0 ? (enAlquiler / total) * 100 : 0,
      }
    } catch (error) {
      console.error('Error getting reporte inventario:', error)
      return null
    }
  }

  return {
    loading,
    getReporteIngresos,
    getIngresosDiarios,
    getCanastillasMasAlquiladas,
    getClientesFrecuentes,
    getReporteInventario,
  }
}