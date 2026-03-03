import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { usePermissions } from './hooks/usePermissions'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { CanastillasPage } from './pages/CanastillasPage'
import { TraspasosPage } from './pages/TraspasosPage'
import { AlquileresPage } from './pages/AlquileresPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { ClientesPage } from './pages/ClientesPage'
import { InventarioPage } from './pages/InventarioPage'
import { PermisosPage } from './pages/PermisosPage'
import { ReportesPage } from './pages/ReportesPage'

// Componente para rutas protegidas
function ProtectedRoute({ children, requirePermission }: { children: React.ReactNode, requirePermission?: () => boolean }) {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/" />
  }

  if (requirePermission && !requirePermission()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-6">No tienes permisos para acceder a esta sección.</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function App() {
  const { user, loading, initialize } = useAuthStore()
  const permissions = usePermissions()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />
        <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to="/dashboard" />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* Rutas protegidas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventario"
          element={
            <ProtectedRoute requirePermission={permissions.canAccessInventario}>
              <InventarioPage />
            </ProtectedRoute>
          }
        />
        
        <Route 
          path="/canastillas" 
          element={
            <ProtectedRoute requirePermission={permissions.canAccessCanastillas}>
              <CanastillasPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/traspasos" 
          element={
            <ProtectedRoute requirePermission={permissions.canAccessTraspasos}>
              <TraspasosPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/alquileres" 
          element={
            <ProtectedRoute requirePermission={permissions.canAccessAlquileres}>
              <AlquileresPage />
            </ProtectedRoute>
          } 
        />
        
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute requirePermission={permissions.canAccessUsuarios}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <ProtectedRoute requirePermission={permissions.canAccessClientes}>
              <ClientesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/permisos"
          element={
            <ProtectedRoute>
              <PermisosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reportes"
          element={
            <ProtectedRoute requirePermission={permissions.canAccessReportes}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta 404 */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App