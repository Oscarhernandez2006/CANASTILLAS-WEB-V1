import { ReactNode, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useGeolocationSender } from '@/hooks/useGeolocation'

interface DashboardLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { permissionState } = useGeolocationSender(true)

  const handleRequestPermission = () => {
    // Al llamar getCurrentPosition, el navegador volverá a pedir permiso
    // si el usuario borró la configuración del sitio previamente.
    // Si ya fue denegado permanentemente, mostramos instrucciones.
    navigator.geolocation.getCurrentPosition(
      () => {
        // Éxito: el permiso fue concedido, el estado se actualizará automáticamente
        window.location.reload()
      },
      () => {
        // Si sigue denegado, hay que ir a configuración del navegador
        alert(
          'La geolocalización fue bloqueada permanentemente.\n\n' +
          'Para habilitarla:\n' +
          '1. Haz clic en el ícono de candado (🔒) en la barra de direcciones\n' +
          '2. Busca "Ubicación" o "Location"\n' +
          '3. Cambia a "Permitir"\n' +
          '4. Recarga la página'
        )
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Banner obligatorio de geolocalización */}
        {permissionState === 'denied' && (
          <div className="bg-red-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 z-[999]">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium">
                <strong>Geolocalización bloqueada.</strong> Es obligatorio permitir la ubicación para usar el sistema.
              </span>
            </div>
            <button
              onClick={handleRequestPermission}
              className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors flex-shrink-0"
            >
              Habilitar ubicación
            </button>
          </div>
        )}

        {permissionState === 'prompt' && (
          <div className="bg-amber-500 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 z-[999]">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium">
                Se requiere acceso a tu ubicación para continuar. Por favor acepta el permiso cuando aparezca.
              </span>
            </div>
            <button
              onClick={handleRequestPermission}
              className="bg-white text-amber-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-amber-50 transition-colors flex-shrink-0"
            >
              Permitir ubicación
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
