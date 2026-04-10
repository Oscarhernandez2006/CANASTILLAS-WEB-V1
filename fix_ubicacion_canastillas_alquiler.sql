-- ============================================================
-- ELIMINAR canastillas del usuario ricardohernandez@grupo-santacruz.com
-- ============================================================

-- 1. PREVIEW: Ver las canastillas que se van a eliminar
SELECT c.id, c.codigo, c.status, c.current_location, u.email
FROM canastillas c
JOIN users u ON u.id = c.current_owner_id
WHERE u.email = 'ricardohernandez@grupo-santacruz.com';

-- 2. Eliminar registros relacionados en rental_return_items
DELETE FROM rental_return_items
WHERE canastilla_id IN (
  SELECT c.id FROM canastillas c
  JOIN users u ON u.id = c.current_owner_id
  WHERE u.email = 'ricardohernandez@grupo-santacruz.com'
);

-- 3. Eliminar registros relacionados en rental_items
DELETE FROM rental_items
WHERE canastilla_id IN (
  SELECT c.id FROM canastillas c
  JOIN users u ON u.id = c.current_owner_id
  WHERE u.email = 'ricardohernandez@grupo-santacruz.com'
);

-- 4. Eliminar registros relacionados en transfer_items
DELETE FROM transfer_items
WHERE canastilla_id IN (
  SELECT c.id FROM canastillas c
  JOIN users u ON u.id = c.current_owner_id
  WHERE u.email = 'ricardohernandez@grupo-santacruz.com'
);

-- 5. Eliminar registros relacionados en pickup_assignment_items
DELETE FROM pickup_assignment_items
WHERE canastilla_id IN (
  SELECT c.id FROM canastillas c
  JOIN users u ON u.id = c.current_owner_id
  WHERE u.email = 'ricardohernandez@grupo-santacruz.com'
);

-- 6. Eliminar registros relacionados en canastillas_salidas
DELETE FROM canastillas_salidas
WHERE canastilla_id IN (
  SELECT c.id FROM canastillas c
  JOIN users u ON u.id = c.current_owner_id
  WHERE u.email = 'ricardohernandez@grupo-santacruz.com'
);

-- 7. Eliminar las canastillas
DELETE FROM canastillas
WHERE current_owner_id = (
  SELECT id FROM users WHERE email = 'ricardohernandez@grupo-santacruz.com'
);
