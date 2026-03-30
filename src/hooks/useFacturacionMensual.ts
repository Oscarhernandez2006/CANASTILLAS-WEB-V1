/**
 * @module useFacturacionMensual
 * @description Hook para la gestión de facturación mensual de alquileres.
 * Agrupa sub-facturas por cliente y mes, permite generar facturas mensuales consolidadas,
 * firmar PDFs digitalmente y consultar el historial de facturación.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { SalePoint, SignatureData } from '@/types'
import { getFacturaMensualPDFBlob, openFacturaMensualPDF } from '@/utils/facturaMensualGenerator'
import type { FacturaMensualPDFData } from '@/utils/facturaMensualGenerator'
import { uploadSignedPDF } from '@/services/storageService'

export interface SubFactura {
  id: string
  rental_id: string
  return_date: string
  days_charged: number
  amount: number
  invoice_number: string
  notes?: string
  signed_pdf_url?: string
  rental: {
    id: string
    rental_type: 'INTERNO' | 'EXTERNO'
    start_date: string
    daily_rate: number
    remision_number?: string
    sale_point?: SalePoint
  }
  items_count: number
}

export interface FacturaMensual {
  id: string
  sale_point_id: string
  sale_point: SalePoint
  month: number // 1-12
  year: number
  invoice_number: string
  total_amount: number
  sub_invoice_ids: string[]
  sub_facturas: SubFactura[]
  signed_pdf_url?: string
  created_at: string
  created_by: string
  notes?: string
  discount?: number
  closed_at?: string
  closed_by?: string
}

export interface ClienteConSubFacturas {
  sale_point: SalePoint
  subFacturas: SubFactura[]
  totalMes: number
  totalCanastillas: number
  facturaMensualExistente?: FacturaMensual
}

/**
 * Hook que gestiona la facturación mensual consolidada por cliente.
 * @returns Objeto con clientes, facturas mensuales, mes/año seleccionado y funciones de gestión.
 * @returns {ClienteConSubFacturas[]} clientes - Clientes con sus sub-facturas del mes.
 * @returns {FacturaMensual[]} facturasMensuales - Facturas mensuales generadas.
 * @returns {boolean} loading - Estado de carga.
 * @returns {number} selectedMonth - Mes seleccionado (1-12).
 * @returns {number} selectedYear - Año seleccionado.
 */
export function useFacturacionMensual() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteConSubFacturas[]>([])
  const [facturasMensuales, setFacturasMensuales] = useState<FacturaMensual[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, selectedMonth, selectedYear])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Calcular rango de fechas del mes seleccionado
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()

      // 1. Obtener todas las sub-facturas (rental_returns) del mes
      const { data: rentalReturns, error: returnsError } = await supabase
        .from('rental_returns')
        .select(`
          id,
          rental_id,
          return_date,
          days_charged,
          amount,
          invoice_number,
          notes,
          signed_pdf_url,
          rental:rentals!inner(
            id,
            rental_type,
            start_date,
            daily_rate,
            remision_number,
            sale_point_id,
            sale_point:sale_points(*)
          )
        `)
        .gte('return_date', startDate)
        .lte('return_date', endDate)
        .order('return_date', { ascending: false })

      if (returnsError) throw returnsError

      // Obtener conteo de items por cada rental_return
      const subFacturasWithCounts: SubFactura[] = await Promise.all(
        (rentalReturns || []).map(async (ret: any) => {
          const { count } = await supabase
            .from('rental_return_items')
            .select('*', { count: 'exact', head: true })
            .eq('rental_return_id', ret.id)

          return {
            ...ret,
            items_count: count || 0,
          }
        })
      )

      // 2. Agrupar sub-facturas por cliente (sale_point)
      const clienteMap: Record<string, ClienteConSubFacturas> = {}

      for (const sf of subFacturasWithCounts) {
        const rental = sf.rental as any
        const salePoint = rental?.sale_point as SalePoint
        if (!salePoint) continue

        const spId = salePoint.id

        if (!clienteMap[spId]) {
          clienteMap[spId] = {
            sale_point: salePoint,
            subFacturas: [],
            totalMes: 0,
            totalCanastillas: 0,
          }
        }

        clienteMap[spId].subFacturas.push(sf)
        clienteMap[spId].totalMes += sf.amount || 0
        clienteMap[spId].totalCanastillas += sf.items_count || 0
      }

      // 3. Obtener facturas mensuales existentes (solo abiertas - sin cerrar)
      const { data: existingFacturas, error: facturasError } = await supabase
        .from('monthly_invoices')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .is('closed_at', null)

      if (!facturasError && existingFacturas) {
        for (const factura of existingFacturas) {
          if (clienteMap[factura.sale_point_id]) {
            clienteMap[factura.sale_point_id].facturaMensualExistente = factura as FacturaMensual
          }
        }
        setFacturasMensuales(existingFacturas as FacturaMensual[])
      }

      // 4. Obtener facturas CERRADAS para excluir esos clientes del módulo activo
      const { data: closedFacturas } = await supabase
        .from('monthly_invoices')
        .select('sale_point_id')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .not('closed_at', 'is', null)

      const closedSalePointIds = new Set((closedFacturas || []).map((f: any) => f.sale_point_id))

      // Ordenar por total descendente y excluir clientes con factura cerrada
      const clientesList = Object.values(clienteMap)
        .filter(c => !closedSalePointIds.has(c.sale_point.id))
        .sort((a, b) => b.totalMes - a.totalMes)
      setClientes(clientesList)
    } catch (error) {
      console.error('Error fetching facturación mensual:', error)
    } finally {
      setLoading(false)
    }
  }

  const generarFacturaMensual = async (
    salePointId: string,
    cliente: ClienteConSubFacturas,
    notes?: string,
    signatureData?: SignatureData,
    discount?: number
  ): Promise<{ success: boolean; invoiceNumber?: string; error?: string }> => {
    try {
      // Si ya existe una factura mensual para este cliente/periodo, eliminarla
      const { error: deleteError } = await supabase
        .from('monthly_invoices')
        .delete()
        .eq('sale_point_id', salePointId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)

      if (deleteError) {
        console.warn('Error al eliminar factura existente:', deleteError)
        // Intentar con RPC si el delete falla por RLS
        await supabase.rpc('delete_monthly_invoice', {
          p_sale_point_id: salePointId,
          p_month: selectedMonth,
          p_year: selectedYear,
        }).then(({ error }) => {
          if (error) console.warn('RPC delete también falló:', error)
        })
      }

      // Generar número de factura mensual
      const monthStr = String(selectedMonth).padStart(2, '0')
      const yearStr = String(selectedYear)
      const timestamp = Date.now().toString().slice(-6)
      const invoiceNumber = `FM-${yearStr}${monthStr}-${timestamp}`

      // Preparar datos para el PDF
      const pdfData: FacturaMensualPDFData = {
        invoiceNumber,
        salePoint: cliente.sale_point,
        month: selectedMonth,
        year: selectedYear,
        subFacturas: cliente.subFacturas.map(sf => {
          const rental = sf.rental as any
          return {
            invoice_number: sf.invoice_number,
            return_date: sf.return_date,
            days_charged: sf.days_charged,
            amount: sf.amount,
            items_count: sf.items_count,
            rental_type: rental?.rental_type || '-',
            remision_number: rental?.remision_number,
            daily_rate: rental?.daily_rate || 0,
          }
        }),
        totalAmount: cliente.totalMes,
        totalCanastillas: cliente.totalCanastillas,
        notes,
        discount,
      }

      // Generar y subir PDF
      let pdfUrl: string | null = null
      try {
        const pdfBlob = await getFacturaMensualPDFBlob(pdfData, signatureData)
        pdfUrl = await uploadSignedPDF(pdfBlob, 'monthly-invoices', `FM_${invoiceNumber}.pdf`)
      } catch (pdfErr) {
        console.error('Error al generar/subir PDF:', pdfErr)
      }

      // Crear o actualizar registro de factura mensual (upsert por unique constraint)
      const { error: insertError } = await supabase
        .from('monthly_invoices')
        .upsert({
          sale_point_id: salePointId,
          month: selectedMonth,
          year: selectedYear,
          invoice_number: invoiceNumber,
          total_amount: cliente.totalMes - (discount || 0),
          sub_invoice_ids: cliente.subFacturas.map(sf => sf.id),
          notes: notes || null,
          created_by: user?.id || '',
          signed_pdf_url: pdfUrl,
        }, { onConflict: 'sale_point_id,month,year' })
        .select()
        .single()

      if (insertError) throw insertError

      // Abrir PDF
      await openFacturaMensualPDF(pdfData, signatureData)

      await fetchData()
      return { success: true, invoiceNumber }
    } catch (error: any) {
      console.error('Error generando factura mensual:', error)
      return { success: false, error: error.message }
    }
  }

  const cerrarFactura = async (
    facturaId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('monthly_invoices')
        .update({
          closed_at: new Date().toISOString(),
          closed_by: user?.id || '',
        })
        .eq('id', facturaId)

      if (error) throw error

      await fetchData()
      return { success: true }
    } catch (error: any) {
      console.error('Error cerrando factura:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    loading,
    clientes,
    facturasMensuales,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    generarFacturaMensual,
    cerrarFactura,
    refreshData: fetchData,
  }
}
