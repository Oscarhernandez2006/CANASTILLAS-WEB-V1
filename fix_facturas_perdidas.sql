-- =====================================================
-- Tabla: loss_invoices (Facturas por canastillas perdidas)
-- =====================================================

CREATE TABLE IF NOT EXISTS loss_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  
  -- A quién se factura (usuario del sistema O cliente externo)
  billed_user_id UUID REFERENCES users(id),
  billed_user_name TEXT,
  sale_point_id UUID REFERENCES sale_points(id),
  sale_point_name TEXT,
  
  -- Detalle
  items JSONB NOT NULL DEFAULT '[]', -- [{size, color, shape, condition, cantidad, valor_unitario, subtotal}]
  total_canastillas INT NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 14000,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  
  -- Firma de quien emite
  firma_emisor_base64 TEXT,
  firma_emisor_nombre TEXT,
  firma_emisor_cedula TEXT,
  
  -- PDF
  signed_pdf_url TEXT,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'CANCELADA')),
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  
  -- Quien emitió
  created_by UUID REFERENCES users(id),
  created_by_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_loss_invoices_status ON loss_invoices(status);
CREATE INDEX IF NOT EXISTS idx_loss_invoices_created_at ON loss_invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_loss_invoices_sale_point ON loss_invoices(sale_point_id);
CREATE INDEX IF NOT EXISTS idx_loss_invoices_billed_user ON loss_invoices(billed_user_id);

-- RLS
ALTER TABLE loss_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loss_invoices_select" ON loss_invoices FOR SELECT USING (true);
CREATE POLICY "loss_invoices_insert" ON loss_invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "loss_invoices_update" ON loss_invoices FOR UPDATE USING (true);

-- Función para generar número de factura de pérdida
CREATE OR REPLACE FUNCTION generate_loss_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_number TEXT;
  v_seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'FP-[0-9]{6}-([0-9]+)') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM loss_invoices
  WHERE invoice_number LIKE 'FP-' || TO_CHAR(NOW(), 'YYYYMM') || '-%';
  
  v_number := 'FP-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;
