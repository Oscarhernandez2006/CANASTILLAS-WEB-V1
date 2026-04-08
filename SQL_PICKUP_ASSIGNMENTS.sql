-- =============================================
-- TABLAS PARA SISTEMA DE ASIGNACIÓN DE RECOGIDAS
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Tabla principal: asignaciones de recogida
CREATE TABLE IF NOT EXISTS pickup_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id),
  assigned_to UUID NOT NULL REFERENCES users(id),   -- conductor asignado
  assigned_by UUID NOT NULL REFERENCES users(id),   -- super_admin que asignó
  status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'COMPLETADA', 'CANCELADA')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de items: canastillas asociadas a cada recogida
CREATE TABLE IF NOT EXISTS pickup_assignment_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pickup_assignment_id UUID NOT NULL REFERENCES pickup_assignments(id) ON DELETE CASCADE,
  canastilla_id UUID NOT NULL REFERENCES canastillas(id),
  transfer_item_id UUID REFERENCES transfer_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_pickup_assignments_assigned_to ON pickup_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pickup_assignments_transfer_id ON pickup_assignments(transfer_id);
CREATE INDEX IF NOT EXISTS idx_pickup_assignments_status ON pickup_assignments(status);
CREATE INDEX IF NOT EXISTS idx_pickup_assignment_items_assignment ON pickup_assignment_items(pickup_assignment_id);
CREATE INDEX IF NOT EXISTS idx_pickup_assignment_items_canastilla ON pickup_assignment_items(canastilla_id);

-- RLS: habilitar y crear políticas permisivas
ALTER TABLE pickup_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_assignment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pickup_assignments_select" ON pickup_assignments FOR SELECT USING (true);
CREATE POLICY "pickup_assignments_insert" ON pickup_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "pickup_assignments_update" ON pickup_assignments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pickup_assignments_delete" ON pickup_assignments FOR DELETE USING (true);

CREATE POLICY "pickup_assignment_items_select" ON pickup_assignment_items FOR SELECT USING (true);
CREATE POLICY "pickup_assignment_items_insert" ON pickup_assignment_items FOR INSERT WITH CHECK (true);
CREATE POLICY "pickup_assignment_items_update" ON pickup_assignment_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "pickup_assignment_items_delete" ON pickup_assignment_items FOR DELETE USING (true);
