-- =====================================================
-- MIGRACIÓN: Traspasos Externos con Devoluciones
-- =====================================================

-- 1. Agregar columnas a la tabla transfers
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS is_external_transfer BOOLEAN DEFAULT FALSE;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS external_recipient_name TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS external_recipient_cedula TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS external_recipient_phone TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS external_recipient_empresa TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS returned_items_count INTEGER DEFAULT 0;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS pending_items_count INTEGER;

-- 2. Crear tabla de devoluciones de traspasos
CREATE TABLE IF NOT EXISTS transfer_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  processed_by UUID NOT NULL REFERENCES users(id),
  -- Firma digital
  firma_entrega_base64 TEXT,
  firma_recibe_base64 TEXT,
  firma_entrega_nombre TEXT,
  firma_recibe_nombre TEXT,
  firma_entrega_cedula TEXT,
  firma_recibe_cedula TEXT,
  signed_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear tabla de items de devolución de traspasos
CREATE TABLE IF NOT EXISTS transfer_return_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_return_id UUID NOT NULL REFERENCES transfer_returns(id) ON DELETE CASCADE,
  canastilla_id UUID NOT NULL REFERENCES canastillas(id),
  transfer_item_id UUID REFERENCES transfer_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_transfer_returns_transfer_id ON transfer_returns(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_return_items_return_id ON transfer_return_items(transfer_return_id);
CREATE INDEX IF NOT EXISTS idx_transfer_return_items_canastilla_id ON transfer_return_items(canastilla_id);
CREATE INDEX IF NOT EXISTS idx_transfers_is_external ON transfers(is_external_transfer) WHERE is_external_transfer = TRUE;

-- 5. RLS Policies para transfer_returns
ALTER TABLE transfer_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfer returns they are involved in"
  ON transfer_returns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_returns.transfer_id
      AND (t.from_user_id = auth.uid() OR t.to_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can insert transfer returns for their transfers"
  ON transfer_returns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.id = transfer_returns.transfer_id
      AND t.from_user_id = auth.uid()
      AND t.is_external_transfer = TRUE
      AND t.status = 'ACEPTADO'
    )
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')
    )
  );

-- 6. RLS Policies para transfer_return_items
ALTER TABLE transfer_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfer return items they are involved in"
  ON transfer_return_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transfer_returns tr
      JOIN transfers t ON t.id = tr.transfer_id
      WHERE tr.id = transfer_return_items.transfer_return_id
      AND (t.from_user_id = auth.uid() OR t.to_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can insert transfer return items for their returns"
  ON transfer_return_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transfer_returns tr
      JOIN transfers t ON t.id = tr.transfer_id
      WHERE tr.id = transfer_return_items.transfer_return_id
      AND t.from_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin')
    )
  );
