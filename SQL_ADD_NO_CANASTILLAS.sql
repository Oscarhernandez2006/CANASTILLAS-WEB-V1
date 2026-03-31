-- ============================================================
-- MIGRACIÓN: Agregar campo no_canastillas a pdv_inventory_uploads
-- Fecha: 2026-03-31
-- Descripción: Permite a los PDV reportar que no tienen canastillas
-- ============================================================

ALTER TABLE pdv_inventory_uploads
ADD COLUMN IF NOT EXISTS no_canastillas BOOLEAN DEFAULT false;

-- Comentario descriptivo
COMMENT ON COLUMN pdv_inventory_uploads.no_canastillas 
IS 'Indica que el punto de venta reportó no tener canastillas en este período';
