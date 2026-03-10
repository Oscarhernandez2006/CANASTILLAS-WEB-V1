-- Migración: Agregar campos de firma de tercero a la tabla transfers
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS firma_tercero_base64 TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS firma_tercero_nombre TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS firma_tercero_cedula TEXT;

-- Agregar campos de firma de tercero a la tabla transfer_returns (devoluciones)
ALTER TABLE transfer_returns ADD COLUMN IF NOT EXISTS firma_tercero_base64 TEXT;
ALTER TABLE transfer_returns ADD COLUMN IF NOT EXISTS firma_tercero_nombre TEXT;
ALTER TABLE transfer_returns ADD COLUMN IF NOT EXISTS firma_tercero_cedula TEXT;
