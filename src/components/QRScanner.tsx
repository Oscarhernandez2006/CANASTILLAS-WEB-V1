import { useState, useEffect, useRef } from 'react'

interface QRScannerProps {
  onScan: (code: string) => void
  placeholder?: string
}

export function QRScanner({ onScan, placeholder = 'Escanea un código QR...' }: QRScannerProps) {
  const [value, setValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Auto-focus al input cuando se monta
    inputRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    setIsScanning(true)

    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Esperar 100ms después del último cambio (el scanner termina rápido)
    timeoutRef.current = setTimeout(() => {
      if (newValue.trim()) {
        onScan(newValue.trim())
        setValue('') // Limpiar para el próximo escaneo
      }
      setIsScanning(false)
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Si presiona Enter manualmente
    if (e.key === 'Enter' && value.trim()) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      onScan(value.trim())
      setValue('')
      setIsScanning(false)
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg 
            className={`h-5 w-5 ${isScanning ? 'text-green-500 animate-pulse' : 'text-gray-400'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-10 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            isScanning 
              ? 'border-green-500 focus:ring-green-500 bg-green-50' 
              : 'border-gray-300 focus:ring-primary-500'
          }`}
        />
      </div>
      
      {isScanning && (
        <div className="absolute top-full mt-1 left-0 right-0">
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center">
            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Escaneando...
          </div>
        </div>
      )}
    </div>
  )
}