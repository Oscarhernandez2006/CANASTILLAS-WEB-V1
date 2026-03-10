-- =====================================================
-- RESET PARA PILOTO - CANASTILLA WEB
-- Deja: usuarios + permisos de usuarios
-- Borra: TODO lo demás (canastillas, alquileres,
--        traspasos, clientes, notificaciones, etc.)
--
-- ⚠️  EJECUTAR EN SUPABASE SQL EDITOR
-- ⚠️  ESTO ES IRREVERSIBLE - HACER BACKUP PRIMERO
-- =====================================================

-- =====================================================
-- 1. BORRAR DATOS EN ORDEN (hijos primero, padres al final)
-- =====================================================

-- Devoluciones de alquiler (items primero, luego cabecera)
TRUNCATE TABLE rental_return_items  RESTART IDENTITY CASCADE;
TRUNCATE TABLE rental_returns       RESTART IDENTITY CASCADE;

-- Items de alquiler
TRUNCATE TABLE rental_items         RESTART IDENTITY CASCADE;

-- Alquileres
TRUNCATE TABLE rentals              RESTART IDENTITY CASCADE;

-- Items de traspasos
TRUNCATE TABLE transfer_items       RESTART IDENTITY CASCADE;

-- Traspasos
TRUNCATE TABLE transfers            RESTART IDENTITY CASCADE;

-- Movimientos de canastillas
TRUNCATE TABLE canastilla_movements RESTART IDENTITY CASCADE;

-- Canastillas dadas de baja
TRUNCATE TABLE canastillas_bajas    RESTART IDENTITY CASCADE;

-- Salidas de canastillas (tabla legacy)
TRUNCATE TABLE canastillas_salidas  RESTART IDENTITY CASCADE;

-- Canastillas (todas)
TRUNCATE TABLE canastillas          RESTART IDENTITY CASCADE;

-- Clientes / Puntos de venta
TRUNCATE TABLE sale_points          RESTART IDENTITY CASCADE;

-- Atributos de canastillas (colores, tamaños, etc. configurables)
TRUNCATE TABLE canastilla_attributes RESTART IDENTITY CASCADE;

-- Notificaciones
TRUNCATE TABLE notifications        RESTART IDENTITY CASCADE;

-- =====================================================
-- 2. RESETEAR CONFIGURACIÓN DE TARIFAS A VALORES BASE
-- =====================================================
TRUNCATE TABLE rental_settings RESTART IDENTITY CASCADE;

INSERT INTO rental_settings (daily_rate, internal_rate, currency, updated_at)
VALUES (500, 1000, 'COP', NOW());

-- =====================================================
-- 3. LIMPIAR ARCHIVOS PDF FIRMADOS EN STORAGE
--    (solo si el bucket "signed-pdfs" existe)
-- =====================================================
-- Nota: esto borra los objetos del bucket en storage.
-- Si el bucket no existe aún, este bloque no hace nada.
DELETE FROM storage.objects
WHERE bucket_id = 'signed-pdfs';

-- =====================================================
-- 4. VERIFICAR LO QUE QUEDÓ
-- =====================================================
SELECT 'users'              AS tabla, COUNT(*) AS registros FROM users
UNION ALL
SELECT 'user_permissions',              COUNT(*) FROM user_permissions
UNION ALL
SELECT 'canastillas',                   COUNT(*) FROM canastillas
UNION ALL
SELECT 'sale_points',                   COUNT(*) FROM sale_points
UNION ALL
SELECT 'rentals',                       COUNT(*) FROM rentals
UNION ALL
SELECT 'rental_items',                  COUNT(*) FROM rental_items
UNION ALL
SELECT 'rental_returns',                COUNT(*) FROM rental_returns
UNION ALL
SELECT 'transfers',                     COUNT(*) FROM transfers
UNION ALL
SELECT 'transfer_items',                COUNT(*) FROM transfer_items
UNION ALL
SELECT 'notifications',                 COUNT(*) FROM notifications
UNION ALL
SELECT 'canastilla_attributes',         COUNT(*) FROM canastilla_attributes
UNION ALL
SELECT 'rental_settings',               COUNT(*) FROM rental_settings
ORDER BY tabla;

-- =====================================================
-- RESULTADO ESPERADO:
--   users             → N  (los que tenías)
--   user_permissions  → N  (los que tenías)
--   todo lo demás     → 0
-- =====================================================
