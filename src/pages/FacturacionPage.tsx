import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { FirmaDigitalModal } from '@/components/FirmaDigitalModal'
import { useFacturacionMensual, type SubFactura, type ClienteConSubFacturas } from '@/hooks/useFacturacionMensual'
import { formatCurrency, formatDate } from '@/utils/helpers'
import type { SignatureData } from '@/types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

type TabType = 'pendientes' | 'facturadas' | 'todas'

export function FacturacionPage() {
  const {
    loading,
    clientes,
    facturasMensuales,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    generarFacturaMensual,
    cerrarFactura,
  } = useFacturacionMensual()

  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [closingFor, setClosingFor] = useState<string | null>(null)
  const [notasFactura, setNotasFactura] = useState('')
  const [descuentoFactura, setDescuentoFactura] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('todas')
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  const [clienteParaFacturar, setClienteParaFacturar] = useState<ClienteConSubFacturas | null>(null)

  const handleIniciarFacturacion = (cliente: ClienteConSubFacturas) => {
    const descuento = parseFloat(descuentoFactura) || 0
    if (descuento > cliente.totalMes) {
      alert('El descuento no puede ser mayor al total de la factura.')
      return
    }
    const accion = cliente.facturaMensualExistente ? 'Re-generar' : 'Generar'
    const totalFinal = cliente.totalMes - descuento
    const descuentoMsg = descuento > 0 ? `\nDescuento: ${formatCurrency(descuento)}\nTotal con descuento: ${formatCurrency(totalFinal)}` : ''
    if (!confirm(`¿${accion} factura mensual para ${cliente.sale_point.name}?\n\nSubtotal: ${formatCurrency(cliente.totalMes)}${descuentoMsg}\nSub-facturas: ${cliente.subFacturas.length}`)) {
      return
    }
    setClienteParaFacturar(cliente)
    setShowFirmaModal(true)
  }

  const handleFirmaConfirm = async (signatureData: SignatureData) => {
    if (!clienteParaFacturar) return
    setShowFirmaModal(false)

    const cliente = clienteParaFacturar
    setGeneratingFor(cliente.sale_point.id)

    const descuento = parseFloat(descuentoFactura) || 0
    const result = await generarFacturaMensual(
      cliente.sale_point.id,
      cliente,
      notasFactura || undefined,
      signatureData,
      descuento > 0 ? descuento : undefined
    )

    const totalFinal = cliente.totalMes - descuento
    if (result.success) {
      alert(`Factura mensual generada exitosamente.\n\nNúmero: ${result.invoiceNumber}\nTotal: ${formatCurrency(totalFinal)}`)
      setNotasFactura('')
      setDescuentoFactura('')
    } else {
      alert('Error al generar factura: ' + result.error)
    }
    setGeneratingFor(null)
    setClienteParaFacturar(null)
  }

  const handleVerSubFactura = (sf: SubFactura) => {
    if (sf.signed_pdf_url) {
      window.open(sf.signed_pdf_url, '_blank')
    } else {
      alert('No hay PDF disponible para esta sub-factura.')
    }
  }

  const handleVerFacturaMensual = (cliente: ClienteConSubFacturas) => {
    const factura = cliente.facturaMensualExistente
    if (factura?.signed_pdf_url) {
      window.open(factura.signed_pdf_url, '_blank')
    } else {
      alert('No hay PDF disponible para esta factura mensual.')
    }
  }

  const handleCierreTotal = async (cliente: ClienteConSubFacturas) => {
    const factura = cliente.facturaMensualExistente
    if (!factura) return

    if (!confirm(
      `¿Realizar CIERRE TOTAL de la factura ${factura.invoice_number} para ${cliente.sale_point.name}?\n\n` +
      `Total: ${formatCurrency(factura.total_amount)}\n\n` +
      `⚠️ Esta acción es irreversible. La factura pasará al módulo de Consultar Facturación y no podrá modificarse.`
    )) return

    setClosingFor(cliente.sale_point.id)
    const result = await cerrarFactura(factura.id)
    if (result.success) {
      alert(`Factura ${factura.invoice_number} cerrada exitosamente.\n\nPuede consultarla en el módulo "Consultar Facturación".`)
    } else {
      alert('Error al cerrar factura: ' + result.error)
    }
    setClosingFor(null)
  }

  const toggleClient = (spId: string) => {
    setExpandedClient(prev => prev === spId ? null : spId)
  }

  // Filtros
  const filteredClientes = clientes.filter((cliente: ClienteConSubFacturas) => {
    // Filtro por tab
    if (activeTab === 'pendientes' && cliente.facturaMensualExistente) return false
    if (activeTab === 'facturadas' && !cliente.facturaMensualExistente) return false

    // Filtro por búsqueda
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchCliente = cliente.sale_point.name.toLowerCase().includes(q)
        || (cliente.sale_point.identification || '').toLowerCase().includes(q)
        || (cliente.sale_point.contact_name || '').toLowerCase().includes(q)
      const matchSubFactura = cliente.subFacturas.some((sf: SubFactura) =>
        sf.invoice_number.toLowerCase().includes(q)
      )
      const matchFacturaMensual = cliente.facturaMensualExistente?.invoice_number?.toLowerCase().includes(q)
      if (!matchCliente && !matchSubFactura && !matchFacturaMensual) return false
    }

    return true
  })

  // Totales globales del mes
  const totalGlobalMes = clientes.reduce((sum: number, c: ClienteConSubFacturas) => sum + c.totalMes, 0)
  const totalSubFacturas = clientes.reduce((sum: number, c: ClienteConSubFacturas) => sum + c.subFacturas.length, 0)
  const totalFacturasGeneradas = facturasMensuales.length
  const totalPendientes = clientes.filter((c: ClienteConSubFacturas) => !c.facturaMensualExistente).length

  return (
    <DashboardLayout
      title="Facturación Mensual"
      subtitle="Consolidación de sub-facturas por cliente"
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
                <p className="text-gray-500">Total mes</p>
                <p className="text-xl font-bold text-primary-600">{formatCurrency(totalGlobalMes)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Sub-facturas</p>
                <p className="text-xl font-bold text-gray-900">{totalSubFacturas}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Facturados</p>
                <p className="text-xl font-bold text-green-600">{totalFacturasGeneradas}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500">Pendientes</p>
                <p className="text-xl font-bold text-amber-600">{totalPendientes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda y tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Búsqueda */}
            <div className="relative flex-1 w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, NIT, Nº factura o sub-factura..."
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

            {/* Tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {([
                { key: 'todas' as TabType, label: 'Todas', count: clientes.length },
                { key: 'pendientes' as TabType, label: 'Pendientes', count: totalPendientes },
                { key: 'facturadas' as TabType, label: 'Facturadas', count: totalFacturasGeneradas },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de clientes */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900">
              {searchQuery ? 'Sin resultados para la búsqueda' : 'Sin facturas este período'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery
                ? `No se encontraron facturas que coincidan con "${searchQuery}"`
                : `No hay sub-facturas de devoluciones en ${MESES[selectedMonth - 1]} ${selectedYear}`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClientes.map((cliente: ClienteConSubFacturas) => {
              const isExpanded = expandedClient === cliente.sale_point.id
              const hasFactura = !!cliente.facturaMensualExistente

              return (
                <div key={cliente.sale_point.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Header del cliente */}
                  <div
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleClient(cliente.sale_point.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${hasFactura ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {cliente.sale_point.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {cliente.sale_point.contact_name} · {cliente.sale_point.contact_phone}
                          </p>
                          {cliente.sale_point.identification && (
                            <p className="text-xs text-gray-400">NIT: {cliente.sale_point.identification}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary-600">
                            {formatCurrency(cliente.totalMes)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cliente.subFacturas.length} sub-factura{cliente.subFacturas.length !== 1 ? 's' : ''} · {cliente.totalCanastillas} canastillas
                          </p>
                        </div>

                        {hasFactura ? (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            FACTURADA
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                            PENDIENTE
                          </span>
                        )}

                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Factura mensual existente */}
                    {hasFactura && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-800">
                              Factura Mensual: {cliente.facturaMensualExistente!.invoice_number}
                            </p>
                            <p className="text-xs text-green-600">
                              Generada el {formatDate(cliente.facturaMensualExistente!.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-bold text-green-700">
                              {formatCurrency(cliente.facturaMensualExistente!.total_amount)}
                            </p>
                            {cliente.facturaMensualExistente!.signed_pdf_url && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleVerFacturaMensual(cliente) }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                                title="Ver/Descargar PDF"
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
                    )}
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
                              {cliente.subFacturas.map((sf: SubFactura) => {
                                const rental = sf.rental as any
                                return (
                                  <tr key={sf.id} className="hover:bg-white">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      {sf.invoice_number}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        rental?.rental_type === 'INTERNO'
                                          ? 'bg-purple-100 text-purple-700'
                                          : 'bg-pink-100 text-pink-700'
                                      }`}>
                                        {rental?.rental_type || '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                      {formatDate(sf.return_date)}
                                    </td>
                                    <td className="px-4 py-3 text-purple-600 font-medium text-xs">
                                      {rental?.remision_number || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-900 font-medium">
                                      {sf.items_count}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-600">
                                      {sf.days_charged}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-600">
                                      {formatCurrency(rental?.daily_rate || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                      {formatCurrency(sf.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {sf.signed_pdf_url ? (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleVerSubFactura(sf) }}
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
                                  TOTAL {MESES[selectedMonth - 1].toUpperCase()} {selectedYear}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-gray-900">
                                  {cliente.totalCanastillas}
                                </td>
                                <td colSpan={2}></td>
                                <td className="px-4 py-3 text-right text-lg font-bold text-primary-600">
                                  {formatCurrency(cliente.totalMes)}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Botón generar factura mensual */}
                          <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-white">
                            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Notas (opcional)
                                </label>
                                <input
                                  type="text"
                                  value={notasFactura}
                                  onChange={(e) => setNotasFactura(e.target.value)}
                                  placeholder="Notas para la factura mensual..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="w-full sm:w-48">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Descuento ($)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={cliente.totalMes}
                                  value={descuentoFactura}
                                  onChange={(e) => setDescuentoFactura(e.target.value)}
                                  placeholder="0"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <Button
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation()
                                  handleIniciarFacturacion(cliente)
                                }}
                                loading={generatingFor === cliente.sale_point.id}
                                disabled={generatingFor !== null}
                                className="whitespace-nowrap"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {hasFactura ? 'Re-generar Factura Mensual' : 'Generar Factura Mensual'}
                              </Button>
                              {hasFactura && (
                                <Button
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    handleCierreTotal(cliente)
                                  }}
                                  loading={closingFor === cliente.sale_point.id}
                                  disabled={closingFor !== null}
                                  className="whitespace-nowrap bg-red-600 hover:bg-red-700"
                                >
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  Cerrar Facturación
                                </Button>
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Firma Digital */}
      <FirmaDigitalModal
        isOpen={showFirmaModal}
        onClose={() => { setShowFirmaModal(false); setClienteParaFacturar(null) }}
        onConfirm={handleFirmaConfirm}
        loading={generatingFor !== null}
        title="Facturar Mensual"
        entregaLabel="FACTURADO POR"
        recibeLabel=""
        mode="entrega-only"
        confirmButtonText="Firmar y Generar Factura"
      />
    </DashboardLayout>
  )
}
