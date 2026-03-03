import { DashboardLayout } from '@/components/DashboardLayout'
import { Inventario } from '@/components/Inventario'

export function InventarioPage() {
  return (
    <DashboardLayout title="Inventario" subtitle="Visualiza el resumen de canastillas por lotes">
      <Inventario />
    </DashboardLayout>
  )
}