-- =====================================================
-- SQL: Función para generar número de remisión de lavado (RL)
-- =====================================================

-- Crear función para generar número de remisión de lavado
CREATE OR REPLACE FUNCTION generate_washing_remision_number()
RETURNS VARCHAR AS $$
DECLARE
  new_number VARCHAR;
  sequence_number INT;
BEGIN
  -- Buscar el máximo número de remisión de lavado existente
  -- Las remisiones de lavado empiezan con 'RL'
  SELECT COALESCE(MAX(CAST(SUBSTRING(remision_number FROM 3) AS INTEGER)), 0) + 1
  INTO sequence_number
  FROM transfers
  WHERE remision_number LIKE 'RL%';

  new_number := 'RL' || LPAD(sequence_number::TEXT, 8, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Agregar columna is_washing_transfer si no existe
ALTER TABLE transfers
ADD COLUMN IF NOT EXISTS is_washing_transfer BOOLEAN DEFAULT FALSE;

-- Verificar que la función se creó correctamente
SELECT generate_washing_remision_number();
