-- =============================================
-- MÓDULO DE AUDITORÍA
-- =============================================

-- Tabla principal de registros de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_role TEXT,
  action TEXT NOT NULL,           -- 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'TRANSFER' | 'RENTAL' | 'RETURN' | 'WASH' | 'UPLOAD' | 'PERMISSION_CHANGE'
  module TEXT NOT NULL,            -- 'canastillas' | 'traspasos' | 'alquileres' | 'usuarios' | 'clientes' | 'facturacion' | 'lavado' | 'permisos' | 'cargue_pdv' | 'auth' | 'rutas'
  description TEXT NOT NULL,       -- Descripción legible del evento
  details JSONB DEFAULT '{}'::jsonb,  -- Detalles adicionales del evento
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_module ON audit_logs(user_id, module);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer audit_logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar audit_logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- =============================================
-- MÓDULO DE RUTAS DE ENTREGA/RECOLECCIÓN
-- =============================================

-- Tabla de rutas
CREATE TABLE IF NOT EXISTS delivery_routes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                  -- Nombre de la ruta (ej: "Ruta Norte - Mañana")
  description TEXT,
  driver_id UUID REFERENCES auth.users(id),  -- Conductor asignado
  driver_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDIENTE',   -- 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA'
  scheduled_date DATE NOT NULL,               -- Fecha programada
  started_at TIMESTAMPTZ,                     -- Cuándo inició la ruta
  completed_at TIMESTAMPTZ,                   -- Cuándo la terminó
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paradas de la ruta (cada punto de entrega/recolección)
CREATE TABLE IF NOT EXISTS delivery_route_stops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  stop_order INT NOT NULL,                    -- Orden de la parada (1, 2, 3...)
  type TEXT NOT NULL DEFAULT 'ENTREGA',       -- 'ENTREGA' | 'RECOLECCION'
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  notes TEXT,
  canastillas_qty INT DEFAULT 0,              -- Cantidad de canastillas a entregar/recoger
  status TEXT NOT NULL DEFAULT 'PENDIENTE',   -- 'PENDIENTE' | 'EN_CAMINO' | 'LLEGADO' | 'COMPLETADA' | 'OMITIDA'
  arrived_at TIMESTAMPTZ,                     -- Cuándo llegó
  completed_at TIMESTAMPTZ,                   -- Cuándo completó la parada
  driver_notes TEXT,                           -- Notas del conductor al completar
  driver_latitude DOUBLE PRECISION,            -- Ubicación del conductor al completar
  driver_longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de posiciones del conductor durante una ruta (para trazar el recorrido)
CREATE TABLE IF NOT EXISTS route_tracking_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON delivery_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_status ON delivery_routes(status);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date ON delivery_routes(scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON delivery_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_status ON delivery_route_stops(status);
CREATE INDEX IF NOT EXISTS idx_tracking_points_route ON route_tracking_points(route_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_time ON route_tracking_points(recorded_at);

-- RLS
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_tracking_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer delivery_routes"
  ON delivery_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar delivery_routes"
  ON delivery_routes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar delivery_routes"
  ON delivery_routes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden leer delivery_route_stops"
  ON delivery_route_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar delivery_route_stops"
  ON delivery_route_stops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar delivery_route_stops"
  ON delivery_route_stops FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden leer route_tracking_points"
  ON route_tracking_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar route_tracking_points"
  ON route_tracking_points FOR INSERT TO authenticated WITH CHECK (true);
