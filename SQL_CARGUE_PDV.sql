-- =============================================
-- TABLAS PARA CARGUE DE INVENTARIO PDV
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Tabla principal de cargues mensuales
CREATE TABLE pdv_inventory_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_cedula TEXT,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2024),
  status TEXT NOT NULL DEFAULT 'completado' CHECK (status IN ('completado', 'pendiente', 'tardio')),
  is_late BOOLEAN DEFAULT FALSE,
  extension_granted_by UUID REFERENCES auth.users(id),
  extension_granted_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_month, period_year)
);

-- 2. Items del cargue (detalle de canastillas por tipo)
CREATE TABLE pdv_inventory_upload_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES pdv_inventory_uploads(id) ON DELETE CASCADE,
  canastilla_size TEXT NOT NULL,
  canastilla_color TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extensiones/oportunidades de cargue
CREATE TABLE pdv_upload_extensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pdv_user_id UUID NOT NULL REFERENCES auth.users(id),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2024),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_by_name TEXT NOT NULL,
  reason TEXT,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pdv_user_id, period_month, period_year)
);

-- Índices para rendimiento
CREATE INDEX idx_pdv_uploads_user ON pdv_inventory_uploads(user_id);
CREATE INDEX idx_pdv_uploads_period ON pdv_inventory_uploads(period_month, period_year);
CREATE INDEX idx_pdv_upload_items_upload ON pdv_inventory_upload_items(upload_id);
CREATE INDEX idx_pdv_extensions_user ON pdv_upload_extensions(pdv_user_id);
CREATE INDEX idx_pdv_extensions_period ON pdv_upload_extensions(period_month, period_year);

-- RLS (Row Level Security)
ALTER TABLE pdv_inventory_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdv_inventory_upload_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdv_upload_extensions ENABLE ROW LEVEL SECURITY;

-- Políticas: todos los usuarios autenticados pueden leer/escribir
CREATE POLICY "Authenticated users can read pdv_inventory_uploads"
  ON pdv_inventory_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pdv_inventory_uploads"
  ON pdv_inventory_uploads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pdv_inventory_uploads"
  ON pdv_inventory_uploads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read pdv_inventory_upload_items"
  ON pdv_inventory_upload_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pdv_inventory_upload_items"
  ON pdv_inventory_upload_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read pdv_upload_extensions"
  ON pdv_upload_extensions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pdv_upload_extensions"
  ON pdv_upload_extensions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pdv_upload_extensions"
  ON pdv_upload_extensions FOR UPDATE TO authenticated USING (true);
