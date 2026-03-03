import { useState, useRef, useEffect } from 'react'

interface DynamicSelectProps {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  onAddNew: (value: string) => void
  required?: boolean
  placeholder?: string
}

export function DynamicSelect({
  label,
  value,
  options,
  onChange,
  onAddNew,
  required,
  placeholder,
}: DynamicSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowAddForm(false)
        setNewValue('')
        setError(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Hacer scroll al dropdown cuando se abre para que sea visible
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Pequeño delay para asegurar que el dropdown ya está renderizado
      setTimeout(() => {
        dropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [isOpen])

  const handleAddNew = async () => {
    if (!newValue.trim()) {
      setError('El valor no puede estar vacío')
      return
    }

    // Validar que no exista ya
    if (options.includes(newValue.trim())) {
      setError('Este valor ya existe')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await onAddNew(newValue.trim())

      onChange(newValue.trim())
      setNewValue('')
      setShowAddForm(false)
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'Error al agregar nuevo valor')
      console.error('Error adding new value:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddNew()
    }
    if (e.key === 'Escape') {
      setShowAddForm(false)
      setNewValue('')
      setError(null)
    }
  }

  const handleCancelForm = () => {
    setShowAddForm(false)
    setNewValue('')
    setError(null)
  }

  const handleSelect = (option: string) => {
    onChange(option)
    setIsOpen(false)
    setShowAddForm(false)
  }

  return (
    <div ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {/* Botón que abre el dropdown (reemplaza el select nativo) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-2 border rounded-lg text-left bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-between ${
            isOpen ? 'border-primary-500 ring-2 ring-primary-500' : 'border-gray-300'
          }`}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value || placeholder || 'Seleccionar...'}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Input oculto para validación de formulario */}
        {required && (
          <input
            type="text"
            value={value}
            required
            onChange={() => {}}
            className="sr-only"
            tabIndex={-1}
          />
        )}

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-[100] w-full bg-white border border-gray-300 rounded-lg shadow-lg top-full mt-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* List of Options */}
            <div className="max-h-48 overflow-y-auto">
              {options.length > 0 ? (
                options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      option === value
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-primary-50'
                    }`}
                  >
                    {option}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No hay opciones disponibles
                </div>
              )}
            </div>

            {/* Add New Button */}
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full text-left px-4 py-2 border-t border-gray-200 text-primary-600 hover:bg-primary-50 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar nuevo {label.toLowerCase()}
            </button>

            {/* Add Form */}
            {showAddForm && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                {error && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {error}
                  </div>
                )}

                <input
                  type="text"
                  placeholder={`Nuevo ${label.toLowerCase()}`}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                  disabled={loading}
                />

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleAddNew}
                    disabled={loading || !newValue.trim()}
                    className="flex-1 px-3 py-1.5 bg-primary-600 text-white rounded text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Agregando...' : 'Agregar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    disabled={loading}
                    className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
