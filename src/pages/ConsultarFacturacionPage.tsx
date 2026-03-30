/**
 * @module ConsultarFacturacionPage
 * @description Consulta de facturas cerradas (solo lectura).
 */
import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/utils/helpers'
import type { SalePoint } from '@/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface SubFacturaDetalle {
  id: string
  invoice_number: string
  return_date: string
  days_charged: number
  amount: number
  signed_pdf_url?: string
  items_count: number
  rental: {
    rental_type: string
    daily_rate: number
    remision_number?: string
  }
}

interface FacturaCerrada {
  id: string
  sale_point_id: string
  month: number
  year: number
  invoice_number: string
  total_amount: number
  sub_invoice_ids: string[]
  signed_pdf_url?: string
  created_at: string
  closed_at: string
  notes?: string
  discount?: number
  sale_point?: SalePoint
}

interface FacturaConDetalle extends FacturaCerrada {
  subFacturas: SubFacturaDetalle[]
  totalCanastillas: number
}

export function ConsultarFacturacionPage() {
  const [loading, setLoading] = useState(true)
  const [facturas, setFacturas] = useState<FacturaConDetalle[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchFacturasCerradas = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('monthly_invoices')
        .select('*, sale_point:sale_points(*)')
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false })

      if (error) throw error

      // Para cada factura cerrada, cargar sus sub-facturas
      const facturasConDetalle: FacturaConDetalle[] = await Promise.all(
        (data || []).map(async (factura: any) => {
          const subIds = factura.sub_invoice_ids || []
          let subFacturas: SubFacturaDetalle[] = []
          let totalCanastillas = 0

          if (subIds.length > 0) {
            const { data: subs } = await supabase
              .from('rental_returns')
              .select(`
                id, invoice_number, return_date, days_charged, amount, signed_pdf_url,
                rental:rentals!inner(rental_type, daily_rate, remision_number)
              `)
              .in('id', subIds)
              .order('return_date', { ascending: false })

            if (subs) {
              subFacturas = await Promise.all(
                subs.map(async (sf: any) => {
                  const { count } = await supabase
                    .from('rental_return_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('rental_return_id', sf.id)
                  const items_count = count || 0
                  totalCanastillas += items_count
                  return { ...sf, items_count }
                })
              )
            }
          }

          return { ...factura, subFacturas, totalCanastillas }
        })
      )

      setFacturas(facturasConDetalle)
    } catch (error) {
      console.error('Error fetching facturas cerradas:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    fetchFacturasCerradas()
  }, [fetchFacturasCerradas])

  const filteredFacturas = facturas.filter(f => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      f.invoice_number.toLowerCase().includes(q) ||
      (f.sale_point?.name || '').toLowerCase().includes(q) ||
      (f.sale_point?.identification || '').toLowerCase().includes(q) ||
      (f.sale_point?.contact_name || '').toLowerCase().includes(q)
    )
  })

  const totalCerrado = filteredFacturas.reduce((sum, f) => sum + f.total_amount, 0)

  return (
    <DashboardLayout
      title="Consultar Facturación"
      subtitle="Facturas cerradas — Solo lectura"
    >
      <div className="space-y-6">
        {/* Selector de mes/año + resumen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                {MESES.map((mes, i) => (
                  <option key={i} value={i + 1}>{mes}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-gray-500">Total cerrado</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalCerrado)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Facturas cerradas</p>
                <p className="text-xl font-bold text-gray-900">{filteredFacturas.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, NIT o Nº factura..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Lista de facturas cerradas */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredFacturas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900">Sin facturas cerradas</p>
            <p className="text-sm text-gray-500 mt-1">
              No hay facturas cerradas para {MESES[selectedMonth - 1]} {selectedYear}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFacturas.map((factura) => {
              const isExpanded = expandedId === factura.id
              const subtotal = factura.discount && factura.discount > 0
                ? factura.total_amount + factura.discount
                : factura.total_amount

              return (
                <div key={factura.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header del cliente */}
                  <div
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(prev => prev === factura.id ? null : factura.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {factura.sale_point?.name || 'Cliente'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {factura.sale_point?.contact_name} · {factura.sale_point?.contact_phone}
                          </p>
                          {factura.sale_point?.identification && (
                            <p className="text-xs text-gray-400">NIT: {factura.sale_point.identification}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-700">
                            {formatCurrency(factura.total_amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {factura.subFacturas.length} sub-factura{factura.subFacturas.length !== 1 ? 's' : ''} · {factura.totalCanastillas} canastillas
                          </p>
                        </div>

                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                          CERRADA
                        </span>

                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Info de la factura mensual */}
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            Factura: {factura.invoice_number}
                          </p>
                          <p className="text-xs text-gray-500">
                            Generada: {formatDate(factura.created_at)} · Cerrada: {formatDate(factura.closed_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {factura.discount && factura.discount > 0 && (
                            <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg font-medium">
                              Desc: -{formatCurrency(factura.discount)}
                            </span>
                          )}
                          {factura.signed_pdf_url && (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(factura.signed_pdf_url, '_blank') }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Ver PDF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detalle expandido: sub-facturas */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <div className="p-4 bg-gray-50">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                          Detalle de Sub-Facturas — {MESES[selectedMonth - 1]} {selectedYear}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-white border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nº Factura</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remisión</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Días</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Tarifa</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">PDF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {factura.subFacturas.map((sf) => {
                                const rental = sf.rental as any
                                return (
                                  <tr key={sf.id} className="hover:bg-white">
                                    <td className="px-4 py-3 font-medium text-gray-900">{sf.invoice_number}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        rental?.rental_type === 'INTERNO'
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-pink-100 text-pink-700'
                                      }`}>
                                        {rental?.rental_type || '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{formatDate(sf.return_date)}</td>
                                    <td className="px-4 py-3 text-purple-600 font-medium text-xs">{rental?.remision_number || '-'}</td>
                                    <td className="px-4 py-3 text-center text-gray-900 font-medium">{sf.items_count}</td>
                                    <td className="px-4 py-3 text-center text-gray-600">{sf.days_charged}</td>
                                    <td className="px-4 py-3 text-center text-gray-600">{formatCurrency(rental?.daily_rate || 0)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(sf.amount)}</td>
                                    <td className="px-4 py-3 text-center">
                                      {sf.signed_pdf_url ? (
                                        <button
                                          onClick={() => window.open(sf.signed_pdf_url, '_blank')}
                                          className="text-purple-600 hover:text-purple-800"
                                          title="Ver PDF de sub-factura"
                                        >
                                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </button>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="bg-white border-t-2 border-gray-300">
                              <tr>
                                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900">
                                  SUBTOTAL
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900">
                                  {factura.totalCanastillas}
                                </td>
                                <td colSpan={2}></td>
                                <td className="px-4 py-3 text-right text-lg font-bold text-primary-600">
                                  {formatCurrency(subtotal)}
                                </td>
                                <td></td>
                              </tr>
                              {factura.discount && factura.discount > 0 && (
                                <tr>
                                  <td colSpan={7} className="px-4 py-2 text-sm font-medium text-amber-700">
                                    DESCUENTO
                                  </td>
                                  <td className="px-4 py-2 text-right font-bold text-amber-700">
                                    -{formatCurrency(factura.discount)}
                                  </td>
                                  <td></td>
                                </tr>
                              )}
                              <tr className="bg-green-50">
                                <td colSpan={7} className="px-4 py-3 text-sm font-bold text-green-800">
                                  TOTAL FACTURA MENSUAL
                                </td>
                                <td className="px-4 py-3 text-right text-xl font-bold text-green-700">
                                  {formatCurrency(factura.total_amount)}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Notas */}
                        {factura.notes && (
                          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs font-medium text-yellow-800 mb-1">Observaciones:</p>
                            <p className="text-sm text-yellow-700">{factura.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
