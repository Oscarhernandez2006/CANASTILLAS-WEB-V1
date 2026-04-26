/** @module SearchableClientSelect @description Selector de clientes/puntos de venta con búsqueda y filtrado en tiempo real. */
import { useState, useRef, useEffect } from 'react'
import type { SalePoint } from '@/types'

interface SearchableClientSelectProps {
  clients: SalePoint[]
  value: string
  onChange: (clientId: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

export function SearchableClientSelect({
  clients,
  value,
  onChange,
  placeholder = 'Buscar cliente o punto de venta...',
  required = false,
  disabled = false,
}: SearchableClientSelectProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedClient = clients.find(c => c.id === value)

  const filtered = search.trim()
    ? clients.filter(c => {
        const term = search.toLowerCase()
        return (
          c.name?.toLowerCase().includes(term) ||
          c.contact_name?.toLowerCase().includes(term) ||
          c.contact_phone?.toLowerCase().includes(term) ||
          c.city?.toLowerCase().includes(term) ||
          c.identification?.toLowerCase().includes(term) ||
          c.code?.toLowerCase().includes(term)
        )
      })
    : clients

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const handleSelect = (clientId: string) => {
    onChange(clientId)
    setSearch('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setSearch('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex].id)
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  const getTypeLabel = (type: string) =>
    type === 'CLIENTE_EXTERNO' ? 'Externo' : 'Punto de venta'

  const getTypeColor = (type: string) =>
    type === 'CLIENTE_EXTERNO'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'

  return (
    <div ref={containerRef} className="relative">
      {required && (
        <input type="text" required value={value} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
      )}

      {value && selectedClient && !isOpen ? (
        <div
          className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
          onClick={() => {
            if (!disabled) {
              setIsOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }
          }}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{selectedClient.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {selectedClient.contact_name} — {selectedClient.city}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getTypeColor(selectedClient.client_type)}`}>
              {getTypeLabel(selectedClient.client_type)}
            </span>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear() }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 flex-shrink-0 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHighlightIndex(-1); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-10 w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
          />
        </div>
      )}

      {isOpen && (
        <ul ref={listRef} className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              {search ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
            </li>
          ) : (
            filtered.map((client, index) => (
              <li
                key={client.id}
                onClick={() => handleSelect(client.id)}
                className={`flex items-center space-x-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  index === highlightIndex
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100'
                    : client.id === value
                    ? 'bg-gray-50 dark:bg-gray-700/50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{client.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {client.contact_name}{client.city ? ` — ${client.city}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getTypeColor(client.client_type)}`}>
                  {getTypeLabel(client.client_type)}
                </span>
                {client.id === value && (
                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
