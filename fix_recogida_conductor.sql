-- ============================================
-- RECOGIDA POR CONDUCTOR: Campos en canastillas
-- ============================================

-- Agregar campos de recogida a canastillas
ALTER TABLE canastillas ADD COLUMN IF NOT EXISTS is_pickup BOOLEAN DEFAULT FALSE;
ALTER TABLE canastillas ADD COLUMN IF NOT EXISTS pickup_client_name TEXT;
ALTER TABLE canastillas ADD COLUMN IF NOT EXISTS pickup_date TIMESTAMPTZ;

-- Tabla para registrar las recogidas del conductor
CREATE TABLE IF NOT EXISTS conductor_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID NOT NULL REFERENCES users(id),
  sale_point_id UUID REFERENCES sale_points(id),
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_phone TEXT,
  client_contact TEXT,
  items_count INTEGER NOT NULL DEFAULT 0,
  remision_number TEXT,
  -- Firma del cliente
  firma_cliente_base64 TEXT,
  firma_cliente_nombre TEXT,
  firma_cliente_cedula TEXT,
  -- Firma del conductor
  firma_conductor_base64 TEXT,
  firma_conductor_nombre TEXT,
  firma_conductor_cedula TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (status IN ('COMPLETADA', 'CANCELADA')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de cada recogida
CREATE TABLE IF NOT EXISTS conductor_pickup_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id UUID NOT NULL REFERENCES conductor_pickups(id) ON DELETE CASCADE,
  canastilla_id UUID NOT NULL REFERENCES canastillas(id),
  previous_owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conductor_pickups_conductor ON conductor_pickups(conductor_id);
CREATE INDEX IF NOT EXISTS idx_conductor_pickups_sale_point ON conductor_pickups(sale_point_id);
CREATE INDEX IF NOT EXISTS idx_conductor_pickup_items_pickup ON conductor_pickup_items(pickup_id);
CREATE INDEX IF NOT EXISTS idx_conductor_pickup_items_canastilla ON conductor_pickup_items(canastilla_id);
CREATE INDEX IF NOT EXISTS idx_canastillas_is_pickup ON canastillas(is_pickup) WHERE is_pickup = TRUE;

-- Función para generar número de remisión de recogida
CREATE OR REPLACE FUNCTION generate_pickup_remision()
RETURNS TEXT AS $$
DECLARE
  v_seq INTEGER;
  v_remision TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(remision_number FROM 'REC-(\d+)') AS INTEGER)), 0) + 1
  INTO v_seq
  FROM conductor_pickups
  WHERE remision_number IS NOT NULL;
  
  v_remision := 'REC-' || LPAD(v_seq::TEXT, 6, '0');
  RETURN v_remision;
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE conductor_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductor_pickup_items ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (los conductores ven las suyas, super_admin ve todas)
DROP POLICY IF EXISTS conductor_pickups_select ON conductor_pickups;
CREATE POLICY conductor_pickups_select ON conductor_pickups FOR SELECT USING (true);

DROP POLICY IF EXISTS conductor_pickups_insert ON conductor_pickups;
CREATE POLICY conductor_pickups_insert ON conductor_pickups FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS conductor_pickups_update ON conductor_pickups;
CREATE POLICY conductor_pickups_update ON conductor_pickups FOR UPDATE USING (true);

DROP POLICY IF EXISTS conductor_pickup_items_select ON conductor_pickup_items;
CREATE POLICY conductor_pickup_items_select ON conductor_pickup_items FOR SELECT USING (true);

DROP POLICY IF EXISTS conductor_pickup_items_insert ON conductor_pickup_items;
CREATE POLICY conductor_pickup_items_insert ON conductor_pickup_items FOR INSERT WITH CHECK (true);

-- ============================================
-- Actualizar accept_transfer_atomic para limpiar campos de recogida
-- Cuando una canastilla se traspasa, se le quita el estado de recogida
-- ============================================
DROP FUNCTION IF EXISTS accept_transfer_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION accept_transfer_atomic(
  p_transfer_id UUID,
  p_user_id UUID,
  p_firma_recibe_base64 TEXT DEFAULT NULL,
  p_firma_recibe_nombre TEXT DEFAULT NULL,
  p_firma_recibe_cedula TEXT DEFAULT NULL,
  p_firma_tercero_base64 TEXT DEFAULT NULL,
  p_firma_tercero_nombre TEXT DEFAULT NULL,
  p_firma_tercero_cedula TEXT DEFAULT NULL,
  p_is_washing_transfer BOOLEAN DEFAULT FALSE,
  p_new_location TEXT DEFAULT NULL,
  p_new_area TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_transfer RECORD;
  v_total_moved INTEGER;
  v_new_status TEXT;
  v_new_location TEXT;
  v_new_area TEXT;
BEGIN
  -- Obtener y bloquear el transfer
  SELECT * INTO v_transfer
  FROM transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transfer no encontrado');
  END IF;

  IF v_transfer.status != 'PENDIENTE' THEN
    RETURN json_build_object('success', false, 'error', 'Transfer ya fue procesado. Estado actual: ' || v_transfer.status);
  END IF;

  -- Determinar nuevo status y ubicación
  IF p_is_washing_transfer THEN
    v_new_status := 'EN_LAVADO';
    v_new_location := COALESCE(p_new_location, 'LAVADO');
    v_new_area := COALESCE(p_new_area, 'Lavado');
  ELSE
    v_new_status := 'DISPONIBLE';
    v_new_location := COALESCE(p_new_location, v_transfer.to_user_id::TEXT);
    v_new_area := p_new_area;
  END IF;

  -- Mover canastillas al receptor Y limpiar campos de recogida
  UPDATE canastillas c
  SET 
    current_owner_id = v_transfer.to_user_id,
    status = v_new_status,
    current_location = v_new_location,
    current_area = v_new_area,
    is_pickup = FALSE,
    pickup_client_name = NULL,
    pickup_date = NULL,
    updated_at = NOW()
  FROM transfer_items ti
  WHERE ti.transfer_id = p_transfer_id
    AND c.id = ti.canastilla_id;

  GET DIAGNOSTICS v_total_moved = ROW_COUNT;

  -- Actualizar transfer
  UPDATE transfers
  SET 
    status = 'ACEPTADO',
    responded_at = NOW(),
    firma_recibe_base64 = COALESCE(p_firma_recibe_base64, firma_recibe_base64),
    firma_recibe_nombre = COALESCE(p_firma_recibe_nombre, firma_recibe_nombre),
    firma_recibe_cedula = COALESCE(p_firma_recibe_cedula, firma_recibe_cedula),
    firma_tercero_base64 = COALESCE(p_firma_tercero_base64, firma_tercero_base64),
    firma_tercero_nombre = COALESCE(p_firma_tercero_nombre, firma_tercero_nombre),
    firma_tercero_cedula = COALESCE(p_firma_tercero_cedula, firma_tercero_cedula),
    items_count = v_total_moved,
    updated_at = NOW()
  WHERE id = p_transfer_id;

  RETURN json_build_object('success', true, 'total_moved', v_total_moved);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- También actualizar auto_accept para limpiar campos de recogida
DROP FUNCTION IF EXISTS auto_accept_pending_transfers();

CREATE OR REPLACE FUNCTION auto_accept_pending_transfers()
RETURNS void AS $$
DECLARE
  v_transfer RECORD;
  v_total_moved INTEGER;
BEGIN
  FOR v_transfer IN
    SELECT id, to_user_id, is_washing_transfer
    FROM transfers
    WHERE status = 'PENDIENTE'
      AND requested_at < NOW() - INTERVAL '7 hours'
    FOR UPDATE
  LOOP
    -- Mover canastillas y limpiar recogida
    UPDATE canastillas c
    SET 
      current_owner_id = v_transfer.to_user_id,
      status = CASE WHEN v_transfer.is_washing_transfer THEN 'EN_LAVADO' ELSE 'DISPONIBLE' END,
      is_pickup = FALSE,
      pickup_client_name = NULL,
      pickup_date = NULL,
      updated_at = NOW()
    FROM transfer_items ti
    WHERE ti.transfer_id = v_transfer.id
      AND c.id = ti.canastilla_id;

    GET DIAGNOSTICS v_total_moved = ROW_COUNT;

    -- Marcar como auto-aceptado
    UPDATE transfers
    SET 
      status = 'ACEPTADO_AUTO',
      responded_at = NOW(),
      items_count = v_total_moved,
      updated_at = NOW()
    WHERE id = v_transfer.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
