-- =====================================================
-- RESET PARA PRODUCCIÓN - CANASTILLA WEB
-- =====================================================
-- CONSERVA: usuarios (users) + permisos (user_permissions)
--           + atributos configurables (canastilla_attributes)
-- BORRA:    TODO lo demás (canastillas, alquileres,
--           traspasos, lavados, facturación, clientes,
--           notificaciones, geolocalización, PDFs, etc.)
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- ⚠️  ESTO ES IRREVERSIBLE - HACER BACKUP PRIMERO
-- =====================================================

BEGIN;

-- =====================================================
-- 1. BORRAR DATOS (hijos primero, padres al final)
-- =====================================================

-- === FACTURACIÓN ===
-- Facturas mensuales (cierre total)
DELETE FROM monthly_invoices;

-- === DEVOLUCIONES DE ALQUILER ===
DELETE FROM rental_return_items;
DELETE FROM rental_returns;

-- === ALQUILERES ===
DELETE FROM rental_items;
DELETE FROM rentals;

-- === DEVOLUCIONES DE TRASPASOS ===
DELETE FROM transfer_return_items;
DELETE FROM transfer_returns;

-- === TRASPASOS ===
DELETE FROM transfer_items;
DELETE FROM transfers;

-- === LAVADO ===
DELETE FROM washing_order_items;
DELETE FROM washing_orders;

-- === CANASTILLAS ===
DELETE FROM canastilla_movements;
DELETE FROM canastillas_bajas;
DELETE FROM canastillas_salidas;
DELETE FROM canastillas;

-- === CLIENTES / PUNTOS DE VENTA ===
DELETE FROM sale_points;

-- === ATRIBUTOS CONFIGURABLES ===
-- (canastilla_attributes se conserva)

-- === NOTIFICACIONES ===
DELETE FROM notifications;

-- === GEOLOCALIZACIÓN ===
DELETE FROM user_locations;

-- =====================================================
-- 2. RESETEAR CONFIGURACIÓN DE TARIFAS
-- =====================================================
DELETE FROM rental_settings;

INSERT INTO rental_settings (daily_rate, internal_rate, currency, updated_at)
VALUES (500, 1000, 'COP', NOW());

-- =====================================================
-- 3. LIMPIAR PDFs FIRMADOS EN STORAGE
-- =====================================================
-- NOTA: Supabase no permite DELETE directo en storage.objects.
-- Para limpiar PDFs, usa el Dashboard de Supabase:
--   Storage → signed-pdfs → Seleccionar todo → Eliminar
-- O desde la app con supabase.storage.from('signed-pdfs').remove([...])

-- =====================================================
-- 4. RESETEAR SECUENCIAS (números de remisión, etc.)
-- =====================================================
-- Si tienes secuencias personalizadas, reseteálas aquí.
-- Ejemplo:
-- ALTER SEQUENCE remision_number_seq RESTART WITH 1;

COMMIT;

-- =====================================================
-- 5. VERIFICACIÓN FINAL
-- =====================================================
SELECT 'users'                  AS tabla, COUNT(*) AS registros FROM users
UNION ALL SELECT 'user_permissions',       COUNT(*) FROM user_permissions
UNION ALL SELECT 'canastillas',            COUNT(*) FROM canastillas
UNION ALL SELECT 'sale_points',            COUNT(*) FROM sale_points
UNION ALL SELECT 'rentals',                COUNT(*) FROM rentals
UNION ALL SELECT 'rental_items',           COUNT(*) FROM rental_items
UNION ALL SELECT 'rental_returns',         COUNT(*) FROM rental_returns
UNION ALL SELECT 'rental_return_items',    COUNT(*) FROM rental_return_items
UNION ALL SELECT 'transfers',              COUNT(*) FROM transfers
UNION ALL SELECT 'transfer_items',         COUNT(*) FROM transfer_items
UNION ALL SELECT 'transfer_returns',       COUNT(*) FROM transfer_returns
UNION ALL SELECT 'transfer_return_items',  COUNT(*) FROM transfer_return_items
UNION ALL SELECT 'washing_orders',         COUNT(*) FROM washing_orders
UNION ALL SELECT 'washing_order_items',    COUNT(*) FROM washing_order_items
UNION ALL SELECT 'monthly_invoices',       COUNT(*) FROM monthly_invoices
UNION ALL SELECT 'canastilla_attributes',  COUNT(*) FROM canastilla_attributes
UNION ALL SELECT 'notifications',          COUNT(*) FROM notifications
UNION ALL SELECT 'user_locations',         COUNT(*) FROM user_locations
UNION ALL SELECT 'rental_settings',        COUNT(*) FROM rental_settings
ORDER BY tabla;

-- =====================================================
-- RESULTADO ESPERADO:
--   users              → N  (tus usuarios configurados)
--   user_permissions   → N  (permisos asignados)
--   canastilla_attributes → N (atributos conservados)
--   rental_settings    → 1  (tarifa base recién insertada)
--   todo lo demás      → 0
-- =====================================================
