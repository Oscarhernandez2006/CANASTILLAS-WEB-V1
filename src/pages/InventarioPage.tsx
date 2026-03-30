/**
 * @module InventarioPage
 * @description Página de inventario de canastillas del usuario actual.
 */
import { DashboardLayout } from '@/components/DashboardLayout'
import { Inventario } from '@/components/Inventario'

export function InventarioPage() {
  return (
    <DashboardLayout title="Inventario" subtitle="Visualiza el resumen de canastillas por lotes">
      <Inventario />
    </DashboardLayout>
  )
}