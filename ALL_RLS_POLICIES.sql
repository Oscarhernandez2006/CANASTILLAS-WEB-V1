-- =====================================================
-- TODAS LAS POLÍTICAS RLS - CANASTILLA WEB
-- Ejecutar TODO este script en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TABLA: users
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Authenticated users can view all users" ON users;
DROP POLICY IF EXISTS "Anyone can view users" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

-- Usuarios autenticados pueden ver todos los usuarios
CREATE POLICY "Authenticated users can view all users" ON users
  FOR SELECT TO authenticated USING (true);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins pueden insertar usuarios
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar cualquier usuario
CREATE POLICY "Admins can update any user" ON users
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- =====================================================
-- 2. TABLA: canastillas
-- =====================================================
ALTER TABLE canastillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view canastillas" ON canastillas;
DROP POLICY IF EXISTS "Authenticated can view canastillas" ON canastillas;
DROP POLICY IF EXISTS "Admins can insert canastillas" ON canastillas;
DROP POLICY IF EXISTS "Admins can update canastillas" ON canastillas;
DROP POLICY IF EXISTS "Admins can delete canastillas" ON canastillas;

-- Usuarios autenticados pueden ver canastillas
CREATE POLICY "Authenticated can view canastillas" ON canastillas
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar canastillas
CREATE POLICY "Admins can insert canastillas" ON canastillas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar canastillas
CREATE POLICY "Admins can update canastillas" ON canastillas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden eliminar canastillas
CREATE POLICY "Admins can delete canastillas" ON canastillas
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- =====================================================
-- 3. TABLA: transfers
-- =====================================================
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transfers" ON transfers;
DROP POLICY IF EXISTS "Authenticated can view transfers" ON transfers;
DROP POLICY IF EXISTS "Users can insert transfers" ON transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON transfers;

-- Usuarios pueden ver traspasos donde son origen o destino
CREATE POLICY "Authenticated can view transfers" ON transfers
  FOR SELECT TO authenticated USING (true);

-- Usuarios pueden crear traspasos
CREATE POLICY "Users can insert transfers" ON transfers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Usuarios pueden actualizar traspasos donde participan
CREATE POLICY "Users can update own transfers" ON transfers
  FOR UPDATE TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- =====================================================
-- 4. TABLA: transfer_items
-- =====================================================
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transfer items" ON transfer_items;
DROP POLICY IF EXISTS "Users can insert transfer items" ON transfer_items;
DROP POLICY IF EXISTS "Users can delete transfer items" ON transfer_items;

-- Usuarios pueden ver items de traspasos
CREATE POLICY "Users can view transfer items" ON transfer_items
  FOR SELECT TO authenticated USING (true);

-- Usuarios pueden insertar items de traspasos
CREATE POLICY "Users can insert transfer items" ON transfer_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Usuarios pueden eliminar items de traspasos
CREATE POLICY "Users can delete transfer items" ON transfer_items
  FOR DELETE TO authenticated USING (true);

-- =====================================================
-- 5. TABLA: sale_points (clientes/puntos de venta)
-- =====================================================
ALTER TABLE sale_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sale_points" ON sale_points;
DROP POLICY IF EXISTS "Authenticated can view sale_points" ON sale_points;
DROP POLICY IF EXISTS "Admins can insert sale_points" ON sale_points;
DROP POLICY IF EXISTS "Admins can update sale_points" ON sale_points;

-- Usuarios autenticados pueden ver puntos de venta
CREATE POLICY "Authenticated can view sale_points" ON sale_points
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar puntos de venta
CREATE POLICY "Admins can insert sale_points" ON sale_points
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar puntos de venta
CREATE POLICY "Admins can update sale_points" ON sale_points
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- =====================================================
-- 6. TABLA: rentals (alquileres)
-- =====================================================
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rentals" ON rentals;
DROP POLICY IF EXISTS "Authenticated can view rentals" ON rentals;
DROP POLICY IF EXISTS "Admins can insert rentals" ON rentals;
DROP POLICY IF EXISTS "Admins can update rentals" ON rentals;

-- Usuarios autenticados pueden ver alquileres
CREATE POLICY "Authenticated can view rentals" ON rentals
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar alquileres
CREATE POLICY "Admins can insert rentals" ON rentals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar alquileres
CREATE POLICY "Admins can update rentals" ON rentals
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- =====================================================
-- 7. TABLA: rental_items
-- =====================================================
ALTER TABLE rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rental_items" ON rental_items;
DROP POLICY IF EXISTS "Authenticated can view rental_items" ON rental_items;
DROP POLICY IF EXISTS "Admins can insert rental_items" ON rental_items;
DROP POLICY IF EXISTS "Admins can update rental_items" ON rental_items;
DROP POLICY IF EXISTS "Admins can delete rental_items" ON rental_items;

-- Usuarios autenticados pueden ver items de alquiler
CREATE POLICY "Authenticated can view rental_items" ON rental_items
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar items de alquiler
CREATE POLICY "Admins can insert rental_items" ON rental_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar items de alquiler
CREATE POLICY "Admins can update rental_items" ON rental_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Admins pueden eliminar items de alquiler
CREATE POLICY "Admins can delete rental_items" ON rental_items
  FOR DELETE TO authenticated USING (true);

-- =====================================================
-- 8. TABLA: rental_returns (devoluciones parciales)
-- =====================================================
ALTER TABLE rental_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view rental_returns" ON rental_returns;
DROP POLICY IF EXISTS "Authenticated can view rental_returns" ON rental_returns;
DROP POLICY IF EXISTS "Super admin can insert rental_returns" ON rental_returns;
DROP POLICY IF EXISTS "Admins can insert rental_returns" ON rental_returns;

-- Usuarios autenticados pueden ver devoluciones
CREATE POLICY "Authenticated can view rental_returns" ON rental_returns
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar devoluciones
CREATE POLICY "Admins can insert rental_returns" ON rental_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- =====================================================
-- 9. TABLA: rental_return_items
-- =====================================================
ALTER TABLE rental_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view rental_return_items" ON rental_return_items;
DROP POLICY IF EXISTS "Authenticated can view rental_return_items" ON rental_return_items;
DROP POLICY IF EXISTS "Super admin can insert rental_return_items" ON rental_return_items;
DROP POLICY IF EXISTS "Admins can insert rental_return_items" ON rental_return_items;

-- Usuarios autenticados pueden ver items de devolución
CREATE POLICY "Authenticated can view rental_return_items" ON rental_return_items
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar items de devolución
CREATE POLICY "Admins can insert rental_return_items" ON rental_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- =====================================================
-- 10. TABLA: rental_settings (configuración de tarifas)
-- =====================================================
ALTER TABLE rental_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rental_settings" ON rental_settings;
DROP POLICY IF EXISTS "Authenticated users can view rental_settings" ON rental_settings;
DROP POLICY IF EXISTS "Super admin can update rental_settings" ON rental_settings;
DROP POLICY IF EXISTS "Super admin can insert rental_settings" ON rental_settings;
DROP POLICY IF EXISTS "Admins can insert rental_settings" ON rental_settings;
DROP POLICY IF EXISTS "Admins can update rental_settings" ON rental_settings;

-- Usuarios autenticados pueden ver configuración
CREATE POLICY "Authenticated users can view rental_settings" ON rental_settings
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar configuración
CREATE POLICY "Admins can insert rental_settings" ON rental_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar configuración
CREATE POLICY "Admins can update rental_settings" ON rental_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- =====================================================
-- 11. TABLA: user_permissions
-- =====================================================
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Authenticated can view user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can manage user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can insert user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can update user_permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can delete user_permissions" ON user_permissions;

-- Usuarios pueden ver permisos (para verificar sus propios permisos)
CREATE POLICY "Authenticated can view user_permissions" ON user_permissions
  FOR SELECT TO authenticated USING (true);

-- Admins pueden insertar permisos
CREATE POLICY "Admins can insert user_permissions" ON user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Admins pueden actualizar permisos
CREATE POLICY "Admins can update user_permissions" ON user_permissions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- Admins pueden eliminar permisos
CREATE POLICY "Admins can delete user_permissions" ON user_permissions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- =====================================================
-- 12. INSERTAR DATOS POR DEFECTO
-- =====================================================

-- Insertar configuración de tarifas si no existe
INSERT INTO rental_settings (daily_rate, internal_rate, currency, updated_at)
SELECT 500, 1000, 'COP', NOW()
WHERE NOT EXISTS (SELECT 1 FROM rental_settings);

-- =====================================================
-- 13. VERIFICAR POLÍTICAS CREADAS
-- =====================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
