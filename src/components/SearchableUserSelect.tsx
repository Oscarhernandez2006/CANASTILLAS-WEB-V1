import { useState, useRef, useEffect } from 'react'

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
  role?: string
  phone?: string
}

interface SearchableUserSelectProps {
  users: UserOption[]
  value: string
  onChange: (userId: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  /** Render extra info badge next to user name */
  renderBadge?: (user: UserOption) => React.ReactNode
}

export function SearchableUserSelect({
  users,
  value,
  onChange,
  placeholder = 'Buscar usuario...',
  required = false,
  disabled = false,
  renderBadge,
}: SearchableUserSelectProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedUser = users.find(u => u.id === value)

  const filtered = search.trim()
    ? users.filter(u => {
        const term = search.toLowerCase()
        return (
          u.first_name?.toLowerCase().includes(term) ||
          u.last_name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          `${u.first_name} ${u.last_name}`.toLowerCase().includes(term) ||
          u.phone?.toLowerCase().includes(term)
        )
      })
    : users

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const handleSelect = (userId: string) => {
    onChange(userId)
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

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Selected user display / Search input */}
      {value && selectedUser && !isOpen ? (
        <div
          className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-primary-400 transition-colors"
          onClick={() => {
            if (!disabled) {
              setIsOpen(true)
              setTimeout(() => inputRef.current?.focus(), 0)
            }
          }}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary-700">
                {selectedUser.first_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedUser.first_name} {selectedUser.last_name}
                {renderBadge && renderBadge(selectedUser)}
              </p>
              <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 flex-shrink-0 ml-2"
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
            onChange={(e) => {
              setSearch(e.target.value)
              setHighlightIndex(-1)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 text-center">
              {search ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}
            </li>
          ) : (
            filtered.map((user, index) => (
              <li
                key={user.id}
                onClick={() => handleSelect(user.id)}
                className={`flex items-center space-x-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  index === highlightIndex
                    ? 'bg-primary-50 text-primary-900'
                    : user.id === value
                    ? 'bg-gray-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary-700">
                    {user.first_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                    {renderBadge && renderBadge(user)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                {user.id === value && (
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
