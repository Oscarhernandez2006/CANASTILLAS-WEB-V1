import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuthStore()
  const permissions = usePermissions()

  const getDisplayName = () => {
    if (user?.first_name) {
      return `${user.first_name} ${user.last_name || ''}`.trim()
    }
    return 'Usuario'
  }

  const getInitial = () => {
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase()
    }
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  const handleLinkClick = () => {
    onClose()
  }

  const NavContent = () => (
    <>
      {/* Dashboard */}
      <Link
        to="/dashboard"
        onClick={handleLinkClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
          location.pathname === '/dashboard'
            ? 'bg-primary-600 text-white'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className="font-medium">Dashboard</span>
      </Link>

      {permissions.canAccessInventario() && (
        <Link
          to="/inventario"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/inventario'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Inventario</span>
        </Link>
      )}

      {permissions.canAccessCanastillas() && (
        <Link
          to="/canastillas"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/canastillas'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="font-medium">Canastillas</span>
        </Link>
      )}

      {permissions.canAccessTraspasos() && (
        <Link
          to="/traspasos"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/traspasos'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="font-medium">Traspasos</span>
        </Link>
      )}

      {permissions.canAccessAlquileres() && (
        <Link
          to="/alquileres"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/alquileres'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-medium">Alquileres</span>
        </Link>
      )}

      {permissions.canAccessReportes() && (
        <Link
          to="/reportes"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/reportes'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium">Reportes</span>
        </Link>
      )}

      {permissions.canAccessClientes() && (
        <Link
          to="/clientes"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/clientes'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-medium">Clientes</span>
        </Link>
      )}

      {permissions.canAccessUsuarios() && (
        <Link
          to="/usuarios"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/usuarios'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="font-medium">Usuarios</span>
        </Link>
      )}

      {user?.role === 'super_admin' && (
        <Link
          to="/permisos"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/permisos'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-medium">Permisos</span>
        </Link>
      )}
    </>
  )

  const UserInfo = () => (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{getInitial()}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{getDisplayName()}</p>
          <p className="text-xs text-gray-500 truncate capitalize">
            {user?.role?.replace('_', ' ')}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden touch-manipulation"
          onClick={onClose}
          onTouchEnd={(e) => {
            e.preventDefault()
            onClose()
          }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden touch-pan-y ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Santacruz" className="h-8" />
              <span className="text-lg font-bold text-primary-600">SANTACRUZ</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              onTouchEnd={(e) => {
                e.preventDefault()
                onClose()
              }}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 touch-manipulation"
              aria-label="Cerrar menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <NavContent />
          </nav>
          <UserInfo />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white border-r border-gray-200">
          <div className="flex flex-col items-center justify-center h-20 px-6 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Grupo Empresarial
            </p>
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Santacruz" className="h-8" />
              <span className="text-xl font-bold text-primary-600">SANTACRUZ</span>
            </div>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <NavContent />
          </nav>
          <UserInfo />
        </div>
      </aside>
    </>
  )
}
