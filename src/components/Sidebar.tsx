/** @module Sidebar @description Barra lateral de navegación con menú agrupado (Operación, Facturación, Administración) y control de permisos. */
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import logoSistema from '@/assets/logo-sistema.ico'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const groupRoutes: Record<string, string[]> = {
  operacion: ['/inventario', '/canastillas', '/traspasos', '/cargue-pdv', '/control-pdv', '/trazabilidad', '/rutas', '/mi-ruta'],
  facturacion: ['/alquileres', '/facturacion', '/consultar-facturacion'],
  admin: ['/clientes', '/usuarios', '/permisos', '/auditoria', '/adicion-inventario', '/consultar-inventario-usuario', '/historial-traspasos'],
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuthStore()
  const permissions = usePermissions()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Auto-abrir el grupo correspondiente a la ruta actual
  useEffect(() => {
    for (const [group, routes] of Object.entries(groupRoutes)) {
      if (routes.includes(location.pathname)) {
        setOpenGroups(prev => ({ ...prev, [group]: true }))
      }
    }
  }, [location.pathname])

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const isGroupOpen = (group: string) => !!openGroups[group]

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

  const linkClass = (path: string) =>
    `flex items-center space-x-3 pl-10 pr-4 py-2.5 rounded-lg transition-colors touch-manipulation text-sm ${
      location.pathname === path
        ? 'bg-primary-600 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`

  const groupHeaderClass = (groupKey: string, paths: string[]) => {
    const isActive = paths.some(p => location.pathname === p)
    return `flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors touch-manipulation ${
      isActive && !isGroupOpen(groupKey)
        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`
  }

  const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  // Determinar qué items de cada grupo son visibles
  const operacionItems = [
    permissions.canAccessInventario() && 'inventario',
    permissions.canAccessCanastillas() && 'canastillas',
    permissions.canAccessTraspasos() && 'traspasos',
    permissions.canAccessCarguePdv() && 'cargue-pdv',
    permissions.canAccessControlPdv() && 'control-pdv',
    user?.role === 'super_admin' && 'trazabilidad',
    permissions.canAccessRutas() && 'rutas',
  ].filter(Boolean)

  const facturacionItems = [
    permissions.canAccessAlquileres() && 'alquileres',
    permissions.canAccessFacturacion() && 'facturacion',
    permissions.canAccessConsultarFacturacion() && 'consultar-facturacion',
  ].filter(Boolean)

  const adminItems = [
    permissions.canAccessClientes() && 'clientes',
    permissions.canAccessUsuarios() && 'usuarios',
    user?.role === 'super_admin' && 'permisos',
    permissions.canAccessAuditoria() && 'auditoria',
    user?.role === 'super_admin' && 'adicion-inventario',
    user?.role === 'super_admin' && 'consultar-inventario-usuario',
    user?.role === 'super_admin' && 'historial-traspasos',
  ].filter(Boolean)

  const isDriver = user?.role === 'conductor'

  const NavContent = () => (
    <>
      {/* Dashboard */}
      <Link
        to="/dashboard"
        onClick={handleLinkClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
          location.pathname === '/dashboard'
            ? 'bg-primary-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        <span className="font-medium">Dashboard</span>
      </Link>

      {/* ── Grupo: Operación ── */}
      {operacionItems.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup('operacion')}
            className={groupHeaderClass('operacion', ['/inventario', '/canastillas', '/traspasos', '/cargue-pdv', '/control-pdv', '/trazabilidad', '/rutas'])}
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Operación</span>
            </div>
            <ChevronIcon open={isGroupOpen('operacion')} />
          </button>
          {isGroupOpen('operacion') && (
            <div className="mt-1 space-y-1">
              {permissions.canAccessInventario() && (
                <Link to="/inventario" onClick={handleLinkClick} className={linkClass('/inventario')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Inventario</span>
                </Link>
              )}
              {permissions.canAccessCanastillas() && (
                <Link to="/canastillas" onClick={handleLinkClick} className={linkClass('/canastillas')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span>Canastillas</span>
                </Link>
              )}
              {permissions.canAccessTraspasos() && (
                <Link to="/traspasos" onClick={handleLinkClick} className={linkClass('/traspasos')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Traspasos</span>
                </Link>
              )}
              {permissions.canAccessCarguePdv() && (
                <Link to="/cargue-pdv" onClick={handleLinkClick} className={linkClass('/cargue-pdv')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Cargue Inventario</span>
                </Link>
              )}
              {permissions.canAccessControlPdv() && (
                <Link to="/control-pdv" onClick={handleLinkClick} className={linkClass('/control-pdv')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Control PDV</span>
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link to="/trazabilidad" onClick={handleLinkClick} className={linkClass('/trazabilidad')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Trazabilidad</span>
                </Link>
              )}
              {permissions.canAccessRutas() && (
                <Link to="/rutas" onClick={handleLinkClick} className={linkClass('/rutas')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Rutas de Entrega</span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Grupo: Facturación ── */}
      {facturacionItems.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup('facturacion')}
            className={groupHeaderClass('facturacion', ['/alquileres', '/facturacion', '/consultar-facturacion'])}
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium">Facturación</span>
            </div>
            <ChevronIcon open={isGroupOpen('facturacion')} />
          </button>
          {isGroupOpen('facturacion') && (
            <div className="mt-1 space-y-1">
              {permissions.canAccessAlquileres() && (
                <Link to="/alquileres" onClick={handleLinkClick} className={linkClass('/alquileres')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Alquileres</span>
                </Link>
              )}
              {permissions.canAccessFacturacion() && (
                <Link to="/facturacion" onClick={handleLinkClick} className={linkClass('/facturacion')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  <span>Facturación</span>
                </Link>
              )}
              {permissions.canAccessConsultarFacturacion() && (
                <Link to="/consultar-facturacion" onClick={handleLinkClick} className={linkClass('/consultar-facturacion')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Consultar Fact.</span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Grupo: Administración ── */}
      {adminItems.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup('admin')}
            className={groupHeaderClass('admin', ['/clientes', '/usuarios', '/permisos', '/auditoria', '/adicion-inventario', '/consultar-inventario-usuario'])}
          >
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="font-medium">Administración</span>
            </div>
            <ChevronIcon open={isGroupOpen('admin')} />
          </button>
          {isGroupOpen('admin') && (
            <div className="mt-1 space-y-1">
              {permissions.canAccessClientes() && (
                <Link to="/clientes" onClick={handleLinkClick} className={linkClass('/clientes')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Clientes</span>
                </Link>
              )}
              {permissions.canAccessUsuarios() && (
                <Link to="/usuarios" onClick={handleLinkClick} className={linkClass('/usuarios')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Usuarios</span>
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link to="/permisos" onClick={handleLinkClick} className={linkClass('/permisos')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Permisos</span>
                </Link>
              )}
              {permissions.canAccessAuditoria() && (
                <Link to="/auditoria" onClick={handleLinkClick} className={linkClass('/auditoria')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Auditoría</span>
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link to="/adicion-inventario" onClick={handleLinkClick} className={linkClass('/adicion-inventario')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Adición Inventario</span>
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link to="/consultar-inventario-usuario" onClick={handleLinkClick} className={linkClass('/consultar-inventario-usuario')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  <span>Inventario por Usuario</span>
                </Link>
              )}
              {user?.role === 'super_admin' && (
                <Link to="/historial-traspasos" onClick={handleLinkClick} className={linkClass('/historial-traspasos')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Historial Traspasos</span>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reportes (individual) */}
      {permissions.canAccessReportes() && (
        <Link
          to="/reportes"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/reportes'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium">Reportes</span>
        </Link>
      )}

      {/* Geolocalización (individual) */}
      {permissions.canAccessGeolocalizacion() && (
        <Link
          to="/geolocalizacion"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/geolocalizacion'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium">Geolocalización</span>
        </Link>
      )}

      {/* Mi Ruta (conductor) */}
      {isDriver && (
        <Link
          to="/mi-ruta"
          onClick={handleLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors touch-manipulation ${
            location.pathname === '/mi-ruta'
              ? 'bg-primary-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="font-medium">Mi Ruta</span>
        </Link>
      )}
    </>
  )

  const UserInfo = () => (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{getInitial()}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getDisplayName()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">
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
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-64 bg-white dark:bg-gray-900 transform transition-transform duration-300 ease-in-out lg:hidden touch-pan-y ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900">
            <div className="flex items-center space-x-2">
              <img src={logoSistema} alt="SIGCAN" className="h-11 w-11 object-contain rounded-xl" />
              <div className="leading-none">
                <p className="text-base font-extrabold tracking-tight text-gray-800">SIGCAN</p>
                <p className="text-sm font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Santacruz</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              onTouchEnd={(e) => {
                e.preventDefault()
                onClose()
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 touch-manipulation"
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
        <div className="flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center justify-center py-2 px-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-b from-slate-50 via-white to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-900">
            <img src={logoSistema} alt="SIGCAN" className="w-36 h-36 object-contain rounded-2xl -mb-4" />
            <p className="text-lg font-extrabold tracking-tight text-gray-800">SIGCAN</p>
            <p className="text-base font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Santacruz</p>
            <div className="mt-1.5 w-12 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary-400 to-transparent"></div>
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
