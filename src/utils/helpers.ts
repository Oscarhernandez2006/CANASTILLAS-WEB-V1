import { clsx, type ClassValue } from 'clsx'

// Función para combinar clases de Tailwind
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Formatear fechas
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formatear moneda
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

// Obtener iniciales del nombre
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// Traducir estados de canastillas
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    EN_USO_INTERNO: 'En Uso Interno',
    EN_ALQUILER: 'En Alquiler',
    EN_LAVADO: 'En Lavado',
    EN_REPARACION: 'En Reparación',
    FUERA_SERVICIO: 'Fuera de Servicio',
    EXTRAVIADA: 'Extraviada',
    DADA_DE_BAJA: 'Dada de Baja',
  }
  return labels[status] || status
}

// Traducir roles
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: 'Super Administrador',
    admin: 'Administrador',
    supervisor: 'Supervisor',
    operator: 'Operario',
    washing_staff: 'Personal de Lavado',
    logistics: 'Logística',
    conductor: 'Conductor',
    client: 'Cliente',
  }
  return labels[role] || role
}

// Color de badge según estado
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DISPONIBLE: 'bg-green-100 text-green-800',
    EN_USO_INTERNO: 'bg-blue-100 text-blue-800',
    EN_ALQUILER: 'bg-purple-100 text-purple-800',
    EN_LAVADO: 'bg-cyan-100 text-cyan-800',
    EN_REPARACION: 'bg-orange-100 text-orange-800',
    FUERA_SERVICIO: 'bg-red-100 text-red-800',
    EXTRAVIADA: 'bg-gray-100 text-gray-800',
    DADA_DE_BAJA: 'bg-stone-100 text-stone-800',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}