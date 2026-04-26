/**
 * @module FacturasPerdidaPage
 * @description Página para emitir y consultar facturas. Los usuarios agregan ítems con descripción,
 * cantidad y valor unitario. Se genera PDF profesional.
 */
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { DashboardLayout } from '@/components/DashboardLayout'
import { FirmaDigitalModal } from '@/components/FirmaDigitalModal'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { openFacturaPerdidaPDF, type FacturaPerdidaPDFData } from '@/utils/facturaPerdidaGenerator'
import { SearchableUserSelect } from '@/components/SearchableUserSelect'
import { SearchableClientSelect } from '@/components/SearchableClientSelect'
import type { SignatureData, User, SalePoint } from '@/types'

interface InvoiceItem {
  id: string
  descripcion: string
  cantidad: number
  valor_unitario: number
  subtotal: number
}

interface LossInvoice {
  id: string
  invoice_number: string
  billed_user_id: string | null
  billed_user_name: string | null
  sale_point_id: string | null
  sale_point_name: string | null
  items: any[]
  total_canastillas: number
  total_amount: number
  notes: string | null
  status: string
  created_by_name: string
  created_at: string
  cancelled_at: string | null
  cancelled_reason: string | null
  firma_emisor_nombre: string | null
}

type TargetType = 'usuario' | 'cliente'

// ── Componente StatCard ──
function StatCard({ icon, label, value, sublabel, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  sublabel?: string
  color: 'purple' | 'green' | 'red' | 'amber'
}) {
  const colors = {
    purple: 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
    green: 'from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700',
    red: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700',
    amber: 'from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700',
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
      <div className={`bg-gradient-to-br ${colors[color]} p-5`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {sublabel && <p className="text-xs text-white/70 mt-1">{sublabel}</p>}
          </div>
          <div className="flex-shrink-0 p-3 bg-white/15 rounded-xl backdrop-blur-sm">{icon}</div>
        </div>
      </div>
    </div>
  )
}

// ── Componente EmptyState ──
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{description}</p>
    </div>
  )
}

export function FacturasPerdidaPage() {
  const { user } = useAuthStore()

  // ── Estado del formulario ──
  const [targetType, setTargetType] = useState<TargetType>('usuario')
  const [users, setUsers] = useState<User[]>([])
  const [salePoints, setSalePoints] = useState<SalePoint[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [notes, setNotes] = useState('')

  // ── Items de factura ──
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [newItem, setNewItem] = useState({ descripcion: '', cantidad: '' as string | number, valor_unitario: '' as string | number })

  // ── Estado de firma y emisión ──
  const [showFirma, setShowFirma] = useState(false)
  const [emitting, setEmitting] = useState(false)

  // ── Historial ──
  const [invoices, setInvoices] = useState<LossInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [invoiceToCancel, setInvoiceToCancel] = useState<LossInvoice | null>(null)

  // ── Filtros consultar ──
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'TODAS' | 'EMITIDA' | 'CANCELADA'>('TODAS')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'emitir' | 'consultar'>('emitir')

  // ── Detalle expandido ──
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)

  // ── Modal de resultado ──
  const [resultModal, setResultModal] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string }>({
    show: false, type: 'success', title: '', message: '',
  })

  // Cargar usuarios y clientes
  useEffect(() => {
    const fetchData = async () => {
      const [usersRes, spRes] = await Promise.all([
        supabase.from('users').select('*').eq('is_active', true).order('first_name'),
        supabase.from('sale_points').select('*').eq('is_active', true).order('name'),
      ])
      if (usersRes.data) setUsers(usersRes.data)
      if (spRes.data) setSalePoints(spRes.data)
    }
    fetchData()
  }, [])

  // Cargar historial de facturas
  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true)
    try {
      const { data } = await supabase
        .from('loss_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      setInvoices(data || [])
    } catch (err) {
      console.error('Error fetching loss invoices:', err)
    } finally {
      setLoadingInvoices(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'consultar') fetchInvoices()
  }, [activeTab, fetchInvoices])

  // ── Filtrado de facturas ──
  const filteredInvoices = useMemo(() => {
    let result = invoices
    if (filterStatus !== 'TODAS') {
      result = result.filter(i => i.status === filterStatus)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(i =>
        i.invoice_number.toLowerCase().includes(q) ||
        (i.billed_user_name || '').toLowerCase().includes(q) ||
        (i.sale_point_name || '').toLowerCase().includes(q) ||
        (i.created_by_name || '').toLowerCase().includes(q)
      )
    }
    if (filterDateFrom) {
      result = result.filter(i => new Date(i.created_at) >= new Date(filterDateFrom))
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(i => new Date(i.created_at) <= to)
    }
    return result
  }, [invoices, filterStatus, searchQuery, filterDateFrom, filterDateTo])

  // ── Stats ──
  const stats = useMemo(() => {
    const total = invoices.length
    const emitidas = invoices.filter(i => i.status === 'EMITIDA').length
    const canceladas = invoices.filter(i => i.status === 'CANCELADA').length
    const montoTotal = invoices.filter(i => i.status === 'EMITIDA').reduce((s, i) => s + i.total_amount, 0)
    return { total, emitidas, canceladas, montoTotal }
  }, [invoices])

  // ── Items helpers ──
  const addItem = () => {
    const cant = Number(newItem.cantidad) || 0
    const vunit = Number(newItem.valor_unitario) || 0
    if (!newItem.descripcion.trim() || cant < 1 || vunit <= 0) return
    const subtotal = cant * vunit
    setInvoiceItems(prev => [...prev, {
      id: Date.now().toString(),
      descripcion: newItem.descripcion.trim(),
      cantidad: cant,
      valor_unitario: vunit,
      subtotal,
    }])
    setNewItem({ descripcion: '', cantidad: '', valor_unitario: '' })
  }

  const removeItem = (id: string) => {
    setInvoiceItems(prev => prev.filter(item => item.id !== id))
  }

  const totalAmount = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0)
  const totalUnidades = invoiceItems.reduce((sum, item) => sum + item.cantidad, 0)

  const getSelectedInfo = () => {
    if (targetType === 'usuario') {
      const u = users.find(u => u.id === selectedId)
      if (!u) return null
      return { name: `${u.first_name} ${u.last_name}`, contact: u.email, phone: u.phone, type: 'usuario' as const }
    } else {
      const sp = salePoints.find(s => s.id === selectedId)
      if (!sp) return null
      return { name: sp.name, contact: sp.contact_name, phone: sp.contact_phone, address: sp.address, identification: sp.identification || undefined, type: 'cliente' as const }
    }
  }

  const selectedInfo = selectedId ? getSelectedInfo() : null

  // ── Emitir factura ──
  const handleEmitir = async (signatureData: SignatureData) => {
    if (!user || !selectedId || invoiceItems.length === 0) return
    setEmitting(true)
    try {
      // Generar número de factura secuencial
      const prefix = `FP-${new Date().toISOString().slice(0,7).replace('-','')}`
      const { data: lastInv } = await supabase
        .from('loss_invoices')
        .select('invoice_number')
        .like('invoice_number', `${prefix}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
      const lastSeq = lastInv?.[0]
        ? parseInt(lastInv[0].invoice_number.split('-').pop() || '0', 10)
        : 0
      const invoiceNumber = `${prefix}-${String(lastSeq + 1).padStart(4, '0')}`
      const info = getSelectedInfo()
      if (!info) throw new Error('No se encontró información del facturado')

      const itemsForDB = invoiceItems.map(({ id, ...rest }) => rest)

      const invoiceRecord = {
        invoice_number: invoiceNumber,
        billed_user_id: targetType === 'usuario' ? selectedId : null,
        billed_user_name: info.name,
        sale_point_id: targetType === 'cliente' ? selectedId : null,
        sale_point_name: targetType === 'cliente' ? info.name : null,
        items: itemsForDB,
        total_canastillas: totalUnidades,
        valor_unitario: 0,
        total_amount: totalAmount,
        notes: notes || null,
        firma_emisor_base64: signatureData.firma_entrega_base64,
        firma_emisor_nombre: signatureData.firma_entrega_nombre,
        firma_emisor_cedula: signatureData.firma_entrega_cedula,
        status: 'EMITIDA',
        created_by: user.id,
        created_by_name: `${user.first_name} ${user.last_name}`,
      }

      const { error: insertError } = await supabase.from('loss_invoices').insert(invoiceRecord)
      if (insertError) throw insertError

      const pdfData: FacturaPerdidaPDFData = {
        invoiceNumber, billedTo: info, items: invoiceItems.map(item => ({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          valor_unitario: item.valor_unitario,
          subtotal: item.subtotal,
        })),
        totalCanastillas: totalUnidades, totalAmount,
        notes: notes || undefined, createdAt: new Date().toISOString(),
        createdByName: `${user.first_name} ${user.last_name}`,
      }
      await openFacturaPerdidaPDF(pdfData, signatureData)

      setSelectedId('')
      setInvoiceItems([])
      setNotes('')
      setShowFirma(false)
      setResultModal({ show: true, type: 'success', title: 'Factura emitida', message: `La factura ${invoiceNumber} fue emitida exitosamente.` })
    } catch (err: any) {
      console.error('Error emitiendo factura:', err)
      setResultModal({ show: true, type: 'error', title: 'Error al emitir', message: err.message || 'Ocurrió un error al emitir la factura.' })
    } finally {
      setEmitting(false)
    }
  }

  // ── Cancelar factura ──
  const handleCancelInvoice = async () => {
    if (!invoiceToCancel || !cancelReason.trim()) return
    setCancellingId(invoiceToCancel.id)
    try {
      const { error } = await supabase
        .from('loss_invoices')
        .update({ status: 'CANCELADA', cancelled_at: new Date().toISOString(), cancelled_reason: cancelReason.trim() })
        .eq('id', invoiceToCancel.id)
      if (error) throw error
      setShowCancelModal(false)
      setInvoiceToCancel(null)
      setCancelReason('')
      fetchInvoices()
      setResultModal({ show: true, type: 'success', title: 'Factura cancelada', message: `La factura ${invoiceToCancel.invoice_number} fue cancelada exitosamente.` })
    } catch (err: any) {
      setResultModal({ show: true, type: 'error', title: 'Error al cancelar', message: err.message || 'Ocurrió un error al cancelar la factura.' })
    } finally {
      setCancellingId(null)
    }
  }

  // ── Reimprimir factura ──
  const handleReprint = async (invoice: LossInvoice) => {
    const billedTo = invoice.sale_point_id
      ? { name: invoice.sale_point_name || 'N/A', type: 'cliente' as const }
      : { name: invoice.billed_user_name || 'N/A', type: 'usuario' as const }

    // Compatibilidad con facturas antiguas (size+color) y nuevas (descripcion)
    const items = (invoice.items || []).map((item: any) => ({
      descripcion: item.descripcion || `${item.size || ''} ${item.color || ''}`.trim() || 'Ítem',
      cantidad: item.cantidad || 0,
      valor_unitario: item.valor_unitario || 0,
      subtotal: item.subtotal || 0,
    }))

    const pdfData: FacturaPerdidaPDFData = {
      invoiceNumber: invoice.invoice_number, billedTo, items,
      totalCanastillas: invoice.total_canastillas, totalAmount: invoice.total_amount,
      notes: invoice.notes || undefined, createdAt: invoice.created_at, createdByName: invoice.created_by_name,
    }
    const sigData: SignatureData | undefined = invoice.firma_emisor_nombre
      ? { firma_entrega_base64: '', firma_recibe_base64: '', firma_entrega_nombre: invoice.firma_emisor_nombre, firma_recibe_nombre: '', firma_entrega_cedula: '', firma_recibe_cedula: '' }
      : undefined
    await openFacturaPerdidaPDF(pdfData, sigData)
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ═══════ HEADER ═══════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Emitir Factura
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Emita facturas personalizadas a usuarios o clientes del sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 shadow-inner">
              {(['emitir', 'consultar'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-md'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab === 'emitir' ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Emitir
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      Consultar
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═════════════════════ TAB: EMITIR ═════════════════════ */}
        {activeTab === 'emitir' && (
          <div className="space-y-6">

            {/* ── Paso 1: Selección ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/80 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-sm font-bold">1</div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800 dark:text-white">Seleccionar destinatario</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Elija a quién se le emitirá la factura</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Toggle tipo */}
                <div className="flex gap-3 mb-5">
                  {([
                    { value: 'usuario' as const, label: 'Usuario del sistema', icon: '👤' },
                    { value: 'cliente' as const, label: 'Cliente / Punto de venta', icon: '🏢' },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setTargetType(opt.value); setSelectedId('') }}
                      className={`flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                        targetType === opt.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500 shadow-sm'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                      }`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className={`text-sm font-medium ${targetType === opt.value ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-300'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Selector destinatario con búsqueda */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    {targetType === 'usuario' ? 'Seleccionar usuario' : 'Seleccionar cliente o punto de venta'}
                  </label>
                  {targetType === 'usuario' ? (
                    <SearchableUserSelect
                      users={users}
                      value={selectedId}
                      onChange={(id) => setSelectedId(id)}
                      placeholder="Buscar por nombre, email..."
                      required
                    />
                  ) : (
                    <SearchableClientSelect
                      clients={salePoints}
                      value={selectedId}
                      onChange={(id) => setSelectedId(id)}
                      placeholder="Buscar por nombre, contacto, ciudad..."
                      required
                    />
                  )}
                </div>

                {/* Tarjeta info del seleccionado */}
                {selectedInfo && (
                  <div className="mt-4 p-4 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200/50 dark:border-purple-800/30">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">
                          {selectedInfo.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-white text-sm">{selectedInfo.name}</p>
                        {selectedInfo.contact && <p className="text-xs text-gray-500 dark:text-gray-400">{selectedInfo.contact}</p>}
                        {selectedInfo.phone && <p className="text-xs text-gray-500 dark:text-gray-400">{selectedInfo.phone}</p>}
                        {'address' in selectedInfo && selectedInfo.address && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{selectedInfo.address}</p>
                        )}
                      </div>
                      <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        selectedInfo.type === 'cliente'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {selectedInfo.type === 'cliente' ? 'Cliente' : 'Usuario'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Paso 2: Agregar ítems ── */}
            {selectedId && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden transition-all duration-300">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/80">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-sm font-bold">2</div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-800 dark:text-white">Agregar ítems a facturar</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Agregue los conceptos que desea cobrar</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5">

                  {/* Formulario agregar ítem */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-5">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción</label>
                        <input
                          type="text"
                          value={newItem.descripcion}
                          onChange={e => setNewItem(prev => ({ ...prev, descripcion: e.target.value }))}
                          placeholder="Ej: Canastillas perdidas, Servicio de lavado..."
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cantidad</label>
                        <input
                          type="number"
                          min={0}
                          value={newItem.cantidad}
                          onChange={e => setNewItem(prev => ({ ...prev, cantidad: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0) }))}
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow text-center"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor unitario (COP)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={newItem.valor_unitario === '' ? '' : Number(newItem.valor_unitario).toLocaleString('es-CO')}
                          onChange={e => {
                            const raw = e.target.value.replace(/\./g, '').replace(/,/g, '')
                            if (raw === '') { setNewItem(prev => ({ ...prev, valor_unitario: '' })); return }
                            const num = parseInt(raw, 10)
                            if (!isNaN(num)) setNewItem(prev => ({ ...prev, valor_unitario: Math.max(0, num) }))
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow text-right"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          onClick={addItem}
                          disabled={!newItem.descripcion.trim() || !newItem.cantidad || Number(newItem.cantidad) < 1 || !newItem.valor_unitario || Number(newItem.valor_unitario) <= 0}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          Agregar
                        </button>
                      </div>
                    </div>
                    {newItem.descripcion.trim() && Number(newItem.cantidad) > 0 && Number(newItem.valor_unitario) > 0 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
                        Subtotal: <span className="font-semibold text-gray-700 dark:text-gray-200">${(Number(newItem.cantidad) * Number(newItem.valor_unitario)).toLocaleString('es-CO')} COP</span>
                      </p>
                    )}
                  </div>

                  {/* Tabla de ítems agregados */}
                  {invoiceItems.length > 0 ? (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gradient-to-r from-purple-50 to-purple-50/50 dark:from-purple-900/20 dark:to-purple-900/10">
                              <th className="px-4 py-3.5 text-left text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">#</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Descripción</th>
                              <th className="px-4 py-3.5 text-center text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Cant.</th>
                              <th className="px-4 py-3.5 text-right text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Vr. Unit.</th>
                              <th className="px-4 py-3.5 text-right text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Subtotal</th>
                              <th className="px-4 py-3.5 text-center text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider w-16"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {invoiceItems.map((item, i) => (
                              <tr key={item.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-900/5 transition-colors group">
                                <td className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">{i + 1}</td>
                                <td className="px-4 py-3 text-gray-800 dark:text-white font-medium">{item.descripcion}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-sm">{item.cantidad}</span>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 font-mono text-xs">${item.valor_unitario.toLocaleString('es-CO')}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800 dark:text-white font-mono">${item.subtotal.toLocaleString('es-CO')}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => removeItem(item.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Eliminar ítem"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-purple-50/50 dark:bg-purple-900/10 border-t-2 border-purple-200 dark:border-purple-700">
                              <td colSpan={2} className="px-4 py-3 text-right text-sm font-semibold text-purple-700 dark:text-purple-300">TOTAL</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-purple-200 dark:bg-purple-800/40 text-purple-800 dark:text-purple-200 font-bold text-sm">{totalUnidades}</span>
                              </td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right font-bold text-purple-800 dark:text-purple-200 font-mono text-lg">${totalAmount.toLocaleString('es-CO')}</td>
                              <td className="px-4 py-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Observaciones y Total */}
                      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                            Observaciones <span className="text-gray-400 dark:text-gray-500">(opcional)</span>
                          </label>
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow resize-none"
                            placeholder="Notas o comentarios sobre esta factura..."
                          />
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{invoiceItems.length} concepto{invoiceItems.length !== 1 ? 's' : ''} — {totalUnidades} unidades</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">${totalAmount.toLocaleString('es-CO')}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">COP</p>
                        </div>
                      </div>

                      {/* Botón emitir */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => setShowFirma(true)}
                          className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Generar Factura — ${totalAmount.toLocaleString('es-CO')} COP
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-purple-400 dark:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sin ítems aún</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use el formulario de arriba para agregar los conceptos a facturar</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════ TAB: CONSULTAR ═════════════════════ */}
        {activeTab === 'consultar' && (
          <div className="space-y-6">

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                color="purple"
                icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Total facturas" value={stats.total}
                sublabel="Emitidas + canceladas"
              />
              <StatCard
                color="green"
                icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Vigentes" value={stats.emitidas}
                sublabel="Facturas activas"
              />
              <StatCard
                color="red"
                icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                label="Canceladas" value={stats.canceladas}
                sublabel="Facturas anuladas"
              />
              <StatCard
                color="amber"
                icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Monto vigente" value={`$${stats.montoTotal.toLocaleString('es-CO')}`}
                sublabel="Total facturado activo"
              />
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar por Nº, cliente, emisor..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
                  />
                </div>
                <div>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
                  >
                    <option value="TODAS">Todos los estados</option>
                    <option value="EMITIDA">Emitidas</option>
                    <option value="CANCELADA">Canceladas</option>
                  </select>
                </div>
                <div>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="Desde"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow" />
                </div>
                <div>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="Hasta"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow" />
                </div>
              </div>
              {(searchQuery || filterStatus !== 'TODAS' || filterDateFrom || filterDateTo) && (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mostrando <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredInvoices.length}</span> de {invoices.length} facturas
                  </p>
                  <button onClick={() => { setSearchQuery(''); setFilterStatus('TODAS'); setFilterDateFrom(''); setFilterDateTo('') }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors">
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Tabla de facturas */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
              {loadingInvoices ? (
                <div className="flex justify-center py-16"><LoadingSpinner /></div>
              ) : filteredInvoices.length === 0 ? (
                <EmptyState
                  icon={<svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                  title={invoices.length === 0 ? 'No hay facturas registradas' : 'Sin resultados'}
                  description={invoices.length === 0 ? 'Las facturas emitidas aparecerán aquí. Vaya a la pestaña "Emitir" para crear una nueva.' : 'No se encontraron facturas con los filtros aplicados. Intente modificar los criterios de búsqueda.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Factura</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facturado a</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Canast.</th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Emisor</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {filteredInvoices.map(inv => (
                        <Fragment key={inv.id}>
                          <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedInvoice === inv.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                <span className="font-mono font-semibold text-purple-700 dark:text-purple-300 text-xs">{inv.invoice_number}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-gray-500 dark:text-gray-300">{(inv.sale_point_name || inv.billed_user_name || 'N').charAt(0)}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{inv.sale_point_name || inv.billed_user_name}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">{inv.sale_point_id ? 'Cliente' : 'Usuario'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-bold text-sm">{inv.total_canastillas}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold text-gray-800 dark:text-white font-mono">${inv.total_amount.toLocaleString('es-CO')}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                inv.status === 'EMITIDA'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'EMITIDA' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center text-gray-500 dark:text-gray-400 text-xs">
                              {new Date(inv.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-3.5 text-center text-gray-500 dark:text-gray-400 text-xs truncate max-w-[120px]">{inv.created_by_name}</td>
                            <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => handleReprint(inv)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-colors" title="Imprimir PDF">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                </button>
                                {inv.status === 'EMITIDA' && (
                                  <button onClick={() => { setInvoiceToCancel(inv); setShowCancelModal(true) }}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors" title="Cancelar factura">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Fila expandida con detalle */}
                          {expandedInvoice === inv.id && (
                            <tr>
                              <td colSpan={8} className="px-4 py-0">
                                <div className="py-4 pl-8 pr-4 bg-gray-50/80 dark:bg-gray-700/20 border-l-4 border-purple-400 dark:border-purple-600 rounded-b-lg mb-2">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Detalles</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-200">{inv.items?.length || 0} concepto{(inv.items?.length || 0) !== 1 ? 's' : ''} — {inv.total_canastillas} unidades</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Firmado por</p>
                                      <p className="text-sm text-gray-700 dark:text-gray-200">{inv.firma_emisor_nombre || inv.created_by_name}</p>
                                    </div>
                                    {inv.status === 'CANCELADA' && (
                                      <div>
                                        <p className="text-xs text-red-500 font-medium mb-1">Motivo cancelación</p>
                                        <p className="text-sm text-red-600 dark:text-red-400">{inv.cancelled_reason}</p>
                                        {inv.cancelled_at && <p className="text-xs text-red-400 mt-0.5">{new Date(inv.cancelled_at).toLocaleDateString('es-CO')}</p>}
                                      </div>
                                    )}
                                  </div>
                                  {inv.items && inv.items.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Ítems facturados</p>
                                      <div className="flex flex-wrap gap-2">
                                        {inv.items.map((item: any, idx: number) => (
                                          <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs">
                                            <span className="font-medium text-gray-700 dark:text-gray-200">{item.cantidad}×</span>
                                            <span className="text-gray-500 dark:text-gray-400">{item.descripcion || `${item.size} ${item.color}`}</span>
                                            {item.subtotal && <span className="text-gray-400 dark:text-gray-500 ml-1">${Number(item.subtotal).toLocaleString('es-CO')}</span>}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {inv.notes && (
                                    <div className="mt-3 p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                                      <p className="text-xs text-amber-700 dark:text-amber-400"><strong>Nota:</strong> {inv.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ MODAL: CANCELAR ═══════ */}
        {showCancelModal && invoiceToCancel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cancelar factura</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{invoiceToCancel.invoice_number}</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Cliente</span>
                    <span className="font-medium text-gray-800 dark:text-white">{invoiceToCancel.sale_point_name || invoiceToCancel.billed_user_name}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500 dark:text-gray-400">Monto</span>
                    <span className="font-bold text-gray-800 dark:text-white">${invoiceToCancel.total_amount.toLocaleString('es-CO')} COP</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Motivo de cancelación <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow resize-none"
                    placeholder="Describa el motivo por el cual se cancela esta factura..."
                    autoFocus
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button onClick={() => { setShowCancelModal(false); setInvoiceToCancel(null); setCancelReason('') }}
                  className="px-4 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors">
                  Volver
                </button>
                <button onClick={handleCancelInvoice} disabled={!cancelReason.trim() || !!cancellingId}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow">
                  {cancellingId ? (
                    <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Cancelando...</span>
                  ) : 'Confirmar cancelación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal firma digital */}
        <FirmaDigitalModal
          isOpen={showFirma} onClose={() => setShowFirma(false)} onConfirm={handleEmitir}
          loading={emitting} title="Firma para Factura"
          mode="entrega-only" entregaLabel="Emitido por" confirmButtonText="Emitir Factura"
        />

        {/* Modal de resultado */}
        {resultModal.show && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setResultModal(p => ({ ...p, show: false }))} />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
              {/* Icono */}
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                resultModal.type === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {resultModal.type === 'success' ? (
                  <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              {/* Título */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{resultModal.title}</h3>
              {/* Mensaje */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{resultModal.message}</p>
              {/* Botón */}
              <button
                onClick={() => setResultModal(p => ({ ...p, show: false }))}
                className={`w-full py-2.5 rounded-xl font-semibold text-white transition-colors ${
                  resultModal.type === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
