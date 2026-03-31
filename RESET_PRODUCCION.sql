-- ============================================================
-- RESET DE PRODUCCIÓN - CANASTILLA WEB
-- Fecha generación: 2026-03-31
-- ============================================================
-- TABLAS QUE SE CONSERVAN:
--   ✅ users
--   ✅ user_permissions
--   ✅ canastilla_attributes
--   ✅ sale_points (clientes)
--
-- TABLAS QUE SE VACÍAN:
--   ❌ canastillas
--   ❌ rentals, rental_items, rental_returns, rental_return_items, rental_settings
--   ❌ transfers, transfer_items, transfer_returns
--   ❌ washing_orders, washing_order_items
--   ❌ delivery_routes, delivery_route_stops, route_tracking_points
--   ❌ pdv_inventory_uploads, pdv_inventory_upload_items, pdv_upload_extensions
--   ❌ monthly_invoices
--   ❌ audit_logs
--   ❌ notifications
--   ❌ user_locations
-- ============================================================

-- IMPORTANTE: Ejecutar en una transacción para poder revertir si algo falla
BEGIN;

-- ============================================================
-- 1. AUDITORÍA Y NOTIFICACIONES
-- ============================================================
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- ============================================================
-- 2. RUTAS DE ENTREGA (hijos primero)
-- ============================================================
TRUNCATE TABLE route_tracking_points CASCADE;
TRUNCATE TABLE delivery_route_stops CASCADE;
TRUNCATE TABLE delivery_routes CASCADE;

-- ============================================================
-- 3. INVENTARIO PDV (hijos primero)
-- ============================================================
TRUNCATE TABLE pdv_inventory_upload_items CASCADE;
TRUNCATE TABLE pdv_upload_extensions CASCADE;
TRUNCATE TABLE pdv_inventory_uploads CASCADE;

-- ============================================================
-- 4. LAVADO
-- ============================================================
TRUNCATE TABLE washing_order_items CASCADE;
TRUNCATE TABLE washing_orders CASCADE;

-- ============================================================
-- 5. DEVOLUCIONES DE ALQUILER (hijos primero)
-- ============================================================
TRUNCATE TABLE rental_return_items CASCADE;
TRUNCATE TABLE rental_returns CASCADE;

-- ============================================================
-- 6. ALQUILERES
-- ============================================================
TRUNCATE TABLE rental_items CASCADE;
TRUNCATE TABLE rentals CASCADE;
TRUNCATE TABLE rental_settings CASCADE;

-- ============================================================
-- 7. TRASPASOS
-- ============================================================
TRUNCATE TABLE transfer_items CASCADE;
TRUNCATE TABLE transfer_returns CASCADE;
TRUNCATE TABLE transfers CASCADE;

-- ============================================================
-- 8. FACTURACIÓN
-- ============================================================
TRUNCATE TABLE monthly_invoices CASCADE;

-- ============================================================
-- 9. GEOLOCALIZACIÓN
-- ============================================================
TRUNCATE TABLE user_locations CASCADE;

-- ============================================================
-- 10. CANASTILLAS (se vacía al final porque otras tablas dependen de ella)
-- ============================================================
TRUNCATE TABLE canastillas CASCADE;

-- ============================================================
-- VERIFICACIÓN: Conteo de registros en tablas vaciadas
-- ============================================================
DO $$
DECLARE
    r RECORD;
    cnt BIGINT;
    tables_to_check TEXT[] := ARRAY[
        'audit_logs', 'notifications',
        'route_tracking_points', 'delivery_route_stops', 'delivery_routes',
        'pdv_inventory_upload_items', 'pdv_upload_extensions', 'pdv_inventory_uploads',
        'washing_order_items', 'washing_orders',
        'rental_return_items', 'rental_returns',
        'rental_items', 'rentals', 'rental_settings',
        'transfer_items', 'transfer_returns', 'transfers',
        'monthly_invoices', 'user_locations', 'canastillas'
    ];
    t TEXT;
BEGIN
    RAISE NOTICE '========== VERIFICACIÓN POST-RESET ==========';
    FOREACH t IN ARRAY tables_to_check LOOP
        EXECUTE format('SELECT count(*) FROM %I', t) INTO cnt;
        IF cnt > 0 THEN
            RAISE WARNING 'TABLA % TODAVÍA TIENE % REGISTROS', t, cnt;
        ELSE
            RAISE NOTICE 'OK: % vacía', t;
        END IF;
    END LOOP;
    RAISE NOTICE '========== TABLAS CONSERVADAS ==========';
    EXECUTE 'SELECT count(*) FROM users' INTO cnt;
    RAISE NOTICE 'users: % registros conservados', cnt;
    EXECUTE 'SELECT count(*) FROM user_permissions' INTO cnt;
    RAISE NOTICE 'user_permissions: % registros conservados', cnt;
    EXECUTE 'SELECT count(*) FROM canastilla_attributes' INTO cnt;
    RAISE NOTICE 'canastilla_attributes: % registros conservados', cnt;
    EXECUTE 'SELECT count(*) FROM sale_points' INTO cnt;
    RAISE NOTICE 'sale_points (clientes): % registros conservados', cnt;
    RAISE NOTICE '=============================================';
END $$;

-- Si todo se ve bien, confirmar:
COMMIT;

-- Si algo salió mal, descomentar la siguiente línea y comentar el COMMIT:
-- ROLLBACK;
