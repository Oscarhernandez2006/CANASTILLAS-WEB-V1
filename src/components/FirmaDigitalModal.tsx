/** @module FirmaDigitalModal @description Modal de captura de firma digital táctil (entrega, recibe, tercero opcional). */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from './Button'
import SignaturePad from 'signature_pad'
import { onlyLetters, onlyNumbers } from '@/utils/helpers'
import type { SignatureData } from '@/types'

export type { SignatureData }

type FirmaModalMode = 'both' | 'entrega-only' | 'recibe-only'

interface FirmaDigitalModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: SignatureData) => void
  loading?: boolean
  title?: string
  entregaLabel?: string
  recibeLabel?: string
  mode?: FirmaModalMode
  prefillEntrega?: {
    nombre: string
    cedula: string
    firma_base64: string
  }
  confirmButtonText?: string
  allowTercero?: boolean
  prefillTercero?: {
    nombre: string
    cedula: string
    firma_base64: string
  }
}

export function FirmaDigitalModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title = 'Firmas Digitales',
  entregaLabel = 'ENTREGA',
  recibeLabel = 'RECIBE',
  mode = 'both',
  prefillEntrega,
  confirmButtonText,
  allowTercero = false,
  prefillTercero,
}: FirmaDigitalModalProps) {
  const [error, setError] = useState('')
  const [entregaNombre, setEntregaNombre] = useState('')
  const [entregaCedula, setEntregaCedula] = useState('')
  const [recibeNombre, setRecibeNombre] = useState('')
  const [recibeCedula, setRecibeCedula] = useState('')
  const [showTercero, setShowTercero] = useState(false)
  const [terceroNombre, setTerceroNombre] = useState('')
  const [terceroCedula, setTerceroCedula] = useState('')

  const canvasEntregaRef = useRef<HTMLCanvasElement>(null)
  const canvasRecibeRef = useRef<HTMLCanvasElement>(null)
  const canvasTerceroRef = useRef<HTMLCanvasElement>(null)
  const padEntregaRef = useRef<SignaturePad | null>(null)
  const padRecibeRef = useRef<SignaturePad | null>(null)
  const padTerceroRef = useRef<SignaturePad | null>(null)
  const containerEntregaRef = useRef<HTMLDivElement>(null)
  const containerRecibeRef = useRef<HTMLDivElement>(null)
  const containerTerceroRef = useRef<HTMLDivElement>(null)

  const showEntregaPad = mode === 'both' || mode === 'entrega-only'
  const showRecibePad = mode === 'both' || mode === 'recibe-only'
  const showEntregaPreview = mode === 'recibe-only' && prefillEntrega

  const resizeCanvas = useCallback((canvas: HTMLCanvasElement, container: HTMLDivElement) => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = container.offsetWidth
    const height = 150
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (showEntregaPad && canvasEntregaRef.current && containerEntregaRef.current) {
          resizeCanvas(canvasEntregaRef.current, containerEntregaRef.current)
          padEntregaRef.current = new SignaturePad(canvasEntregaRef.current, {
            penColor: 'rgb(0, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)'
          })
        }
        if (showRecibePad && canvasRecibeRef.current && containerRecibeRef.current) {
          resizeCanvas(canvasRecibeRef.current, containerRecibeRef.current)
          padRecibeRef.current = new SignaturePad(canvasRecibeRef.current, {
            penColor: 'rgb(0, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)'
          })
        }
        if (showTercero && canvasTerceroRef.current && containerTerceroRef.current) {
          resizeCanvas(canvasTerceroRef.current, containerTerceroRef.current)
          padTerceroRef.current = new SignaturePad(canvasTerceroRef.current, {
            penColor: 'rgb(0, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)'
          })
        }
      }, 100)

      return () => clearTimeout(timer)
    } else {
      padEntregaRef.current = null
      padRecibeRef.current = null
      padTerceroRef.current = null
      setEntregaNombre('')
      setEntregaCedula('')
      setRecibeNombre('')
      setRecibeCedula('')
      setTerceroNombre('')
      setTerceroCedula('')
      setShowTercero(!!prefillTercero)
      setError('')
    }
  }, [isOpen, resizeCanvas, showEntregaPad, showRecibePad, showTercero, prefillTercero])

  // Inicializar pad tercero cuando se activa showTercero mid-session
  useEffect(() => {
    if (!isOpen || !showTercero || prefillTercero) return
    if (padTerceroRef.current) return // ya inicializado

    const timer = setTimeout(() => {
      if (canvasTerceroRef.current && containerTerceroRef.current) {
        resizeCanvas(canvasTerceroRef.current, containerTerceroRef.current)
        padTerceroRef.current = new SignaturePad(canvasTerceroRef.current, {
          penColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgb(255, 255, 255)'
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [isOpen, showTercero, prefillTercero, resizeCanvas])

  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      const entregaData = padEntregaRef.current && !padEntregaRef.current.isEmpty()
        ? padEntregaRef.current.toData()
        : null
      const recibeData = padRecibeRef.current && !padRecibeRef.current.isEmpty()
        ? padRecibeRef.current.toData()
        : null

      if (showEntregaPad && canvasEntregaRef.current && containerEntregaRef.current) {
        resizeCanvas(canvasEntregaRef.current, containerEntregaRef.current)
        if (padEntregaRef.current) {
          padEntregaRef.current.clear()
          if (entregaData) padEntregaRef.current.fromData(entregaData)
        }
      }
      if (showRecibePad && canvasRecibeRef.current && containerRecibeRef.current) {
        resizeCanvas(canvasRecibeRef.current, containerRecibeRef.current)
        if (padRecibeRef.current) {
          padRecibeRef.current.clear()
          if (recibeData) padRecibeRef.current.fromData(recibeData)
        }
      }
      if (showTercero && canvasTerceroRef.current && containerTerceroRef.current) {
        const terceroData = padTerceroRef.current && !padTerceroRef.current.isEmpty()
          ? padTerceroRef.current.toData()
          : null
        resizeCanvas(canvasTerceroRef.current, containerTerceroRef.current)
        if (padTerceroRef.current) {
          padTerceroRef.current.clear()
          if (terceroData) padTerceroRef.current.fromData(terceroData)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, resizeCanvas, showEntregaPad, showRecibePad, showTercero])

  const handleClear = (which: 'entrega' | 'recibe' | 'tercero') => {
    if (which === 'entrega' && padEntregaRef.current) {
      padEntregaRef.current.clear()
    } else if (which === 'recibe' && padRecibeRef.current) {
      padRecibeRef.current.clear()
    } else if (which === 'tercero' && padTerceroRef.current) {
      padTerceroRef.current.clear()
    }
  }

  const handleConfirm = () => {
    setError('')

    // Validar ENTREGA si es necesario
    if (showEntregaPad) {
      if (!padEntregaRef.current || padEntregaRef.current.isEmpty()) {
        setError(`La firma de ${entregaLabel} es obligatoria`)
        return
      }
      if (!entregaNombre.trim()) {
        setError(`El nombre de ${entregaLabel} es obligatorio`)
        return
      }
      if (!entregaCedula.trim()) {
        setError(`La cedula de ${entregaLabel} es obligatoria`)
        return
      }
    }

    // Validar RECIBE si es necesario
    if (showRecibePad) {
      if (!padRecibeRef.current || padRecibeRef.current.isEmpty()) {
        setError(`La firma de ${recibeLabel} es obligatoria`)
        return
      }
      if (!recibeNombre.trim()) {
        setError(`El nombre de ${recibeLabel} es obligatorio`)
        return
      }
      if (!recibeCedula.trim()) {
        setError(`La cedula de ${recibeLabel} es obligatoria`)
        return
      }
    }

    // Validar TERCERO si está visible
    if (showTercero && !prefillTercero) {
      if (!padTerceroRef.current || padTerceroRef.current.isEmpty()) {
        setError('La firma del TERCERO es obligatoria')
        return
      }
      if (!terceroNombre.trim()) {
        setError('El nombre del TERCERO es obligatorio')
        return
      }
      if (!terceroCedula.trim()) {
        setError('La cédula del TERCERO es obligatoria')
        return
      }
    }

    const signatureData: SignatureData = {
      firma_entrega_base64: showEntregaPad
        ? padEntregaRef.current!.toDataURL('image/jpeg', 0.5)
        : (prefillEntrega?.firma_base64 || ''),
      firma_recibe_base64: showRecibePad
        ? padRecibeRef.current!.toDataURL('image/jpeg', 0.5)
        : '',
      firma_entrega_nombre: showEntregaPad
        ? entregaNombre.trim()
        : (prefillEntrega?.nombre || ''),
      firma_recibe_nombre: showRecibePad
        ? recibeNombre.trim()
        : '',
      firma_entrega_cedula: showEntregaPad
        ? entregaCedula.trim()
        : (prefillEntrega?.cedula || ''),
      firma_recibe_cedula: showRecibePad
        ? recibeCedula.trim()
        : '',
      // Firma tercero (solo si se activó)
      firma_tercero_base64: showTercero
        ? (prefillTercero ? prefillTercero.firma_base64 : padTerceroRef.current?.toDataURL('image/jpeg', 0.5))
        : undefined,
      firma_tercero_nombre: showTercero
        ? (prefillTercero ? prefillTercero.nombre : terceroNombre.trim())
        : undefined,
      firma_tercero_cedula: showTercero
        ? (prefillTercero ? prefillTercero.cedula : terceroCedula.trim())
        : undefined,
    }

    onConfirm(signatureData)
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'entrega-only': return 'Firme como quien entrega'
      case 'recibe-only': return 'Firme como quien recibe'
      default: return 'Ambas partes deben firmar para continuar'
    }
  }

  const getButtonText = () => {
    if (confirmButtonText) return confirmButtonText
    switch (mode) {
      case 'entrega-only': return 'Firmar y Enviar'
      case 'recibe-only': return 'Firmar y Aceptar'
      default: return 'Confirmar Firmas'
    }
  }

  // Determinar si usar 2 columnas o 1
  const useGrid = mode === 'both' || (mode === 'recibe-only' && showEntregaPreview)
  const maxWidthClass = showTercero ? 'sm:max-w-5xl' : (useGrid ? 'sm:max-w-3xl' : 'sm:max-w-lg')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        <div
          className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] ${maxWidthClass} mx-4 sm:mx-auto`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-primary-100 mt-0.5">
                  {getSubtitle()}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-white hover:text-gray-200 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg mb-4">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className={useGrid
              ? showTercero
                ? 'grid grid-cols-1 md:grid-cols-3 gap-6'
                : 'grid grid-cols-1 md:grid-cols-2 gap-6'
              : showTercero
                ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
                : 'space-y-6'
            }>
              {/* Seccion ENTREGA - Pad activo */}
              {showEntregaPad && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase">
                      {entregaLabel}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleClear('entrega')}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div ref={containerEntregaRef} className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={canvasEntregaRef}
                      className="w-full touch-none cursor-crosshair"
                      style={{ height: '160px' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">Firme en el recuadro</p>

                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={entregaNombre}
                        onChange={(e) => setEntregaNombre(onlyLetters(e.target.value))}
                        placeholder="Nombre completo"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cedula *</label>
                      <input
                        type="text"
                        value={entregaCedula}
                        onChange={(e) => setEntregaCedula(onlyNumbers(e.target.value))}
                        placeholder="Numero de cedula"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Seccion ENTREGA - Preview read-only (para modo recibe-only) */}
              {showEntregaPreview && (
                <div>
                  <div className="mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase">
                      {entregaLabel} (firmado)
                    </h4>
                  </div>
                  <div className="border-2 border-green-300 rounded-lg overflow-hidden bg-green-50 p-2">
                    {prefillEntrega?.firma_base64 ? (
                      <img
                        src={prefillEntrega.firma_base64}
                        alt="Firma de entrega"
                        className="w-full h-[156px] object-contain bg-white rounded"
                      />
                    ) : (
                      <div className="w-full h-[156px] flex items-center justify-center text-gray-400 text-sm">
                        Sin firma registrada
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Nombre:</span> {prefillEntrega?.nombre || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Cedula:</span> {prefillEntrega?.cedula || 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {/* Seccion RECIBE - Pad activo */}
              {showRecibePad && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase">
                      {recibeLabel}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleClear('recibe')}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div ref={containerRecibeRef} className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={canvasRecibeRef}
                      className="w-full touch-none cursor-crosshair"
                      style={{ height: '160px' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">Firme en el recuadro</p>

                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={recibeNombre}
                        onChange={(e) => setRecibeNombre(onlyLetters(e.target.value))}
                        placeholder="Nombre completo"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cedula *</label>
                      <input
                        type="text"
                        value={recibeCedula}
                        onChange={(e) => setRecibeCedula(onlyNumbers(e.target.value))}
                        placeholder="Numero de cedula"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Seccion TERCERO - Pad activo */}
              {showTercero && !prefillTercero && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-amber-700 uppercase">
                      TERCERO
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleClear('tercero')}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTercero(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div ref={containerTerceroRef} className="border-2 border-amber-300 rounded-lg overflow-hidden bg-white">
                    <canvas
                      ref={canvasTerceroRef}
                      className="w-full touch-none cursor-crosshair"
                      style={{ height: '160px' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">Firme en el recuadro</p>

                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={terceroNombre}
                        onChange={(e) => setTerceroNombre(onlyLetters(e.target.value))}
                        placeholder="Nombre del tercero"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cédula *</label>
                      <input
                        type="text"
                        value={terceroCedula}
                        onChange={(e) => setTerceroCedula(onlyNumbers(e.target.value))}
                        placeholder="Número de cédula"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Seccion TERCERO - Preview read-only */}
              {showTercero && prefillTercero && (
                <div>
                  <div className="mb-2">
                    <h4 className="text-sm font-semibold text-amber-700 uppercase">
                      TERCERO (firmado)
                    </h4>
                  </div>
                  <div className="border-2 border-amber-300 rounded-lg overflow-hidden bg-amber-50 p-2">
                    {prefillTercero?.firma_base64 ? (
                      <img
                        src={prefillTercero.firma_base64}
                        alt="Firma del tercero"
                        className="w-full h-[156px] object-contain bg-white rounded"
                      />
                    ) : (
                      <div className="w-full h-[156px] flex items-center justify-center text-gray-400 text-sm">
                        Sin firma registrada
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Nombre:</span> {prefillTercero?.nombre || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Cédula:</span> {prefillTercero?.cedula || 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Botón para agregar firma de tercero */}
            {allowTercero && !showTercero && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowTercero(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Agregar firma de tercero
                </button>
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
              onClick={handleConfirm}
              loading={loading}
              disabled={loading}
              className="w-full sm:w-auto text-sm order-1 sm:order-2"
            >
              {loading ? 'Procesando...' : getButtonText()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
