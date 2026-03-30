import { supabase } from '@/lib/supabase'
import type { DeliveryRoute, DeliveryRouteStop, RouteTrackingPoint } from '@/types'

// ========== RUTAS ==========

export async function getRoutes(filters?: {
  status?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
}): Promise<DeliveryRoute[]> {
  let query = supabase
    .from('delivery_routes')
    .select('*, stops:delivery_route_stops(*)') 
    .order('scheduled_date', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.driverId) query = query.eq('driver_id', filters.driverId)
  if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw error

  return (data || []).map(r => ({
    ...r,
    stops: (r.stops || []).sort((a: DeliveryRouteStop, b: DeliveryRouteStop) => a.stop_order - b.stop_order),
  }))
}

export async function getRouteById(routeId: string): Promise<DeliveryRoute | null> {
  const { data, error } = await supabase
    .from('delivery_routes')
    .select('*, stops:delivery_route_stops(*)')
    .eq('id', routeId)
    .single()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    stops: (data.stops || []).sort((a: DeliveryRouteStop, b: DeliveryRouteStop) => a.stop_order - b.stop_order),
  }
}

export async function getMyRoutes(driverId: string): Promise<DeliveryRoute[]> {
  const { data, error } = await supabase
    .from('delivery_routes')
    .select('*, stops:delivery_route_stops(*)')
    .eq('driver_id', driverId)
    .in('status', ['PENDIENTE', 'EN_CURSO'])
    .order('scheduled_date', { ascending: true })

  if (error) throw error

  return (data || []).map(r => ({
    ...r,
    stops: (r.stops || []).sort((a: DeliveryRouteStop, b: DeliveryRouteStop) => a.stop_order - b.stop_order),
  }))
}

export async function createRoute(params: {
  name: string
  description?: string
  driverId?: string
  driverName?: string
  scheduledDate: string
  notes?: string
  createdBy: string
  createdByName: string
  stops: Omit<DeliveryRouteStop, 'id' | 'route_id' | 'status' | 'arrived_at' | 'completed_at' | 'driver_notes' | 'driver_latitude' | 'driver_longitude' | 'created_at'>[]
}): Promise<DeliveryRoute> {
  const { data: route, error: routeError } = await supabase
    .from('delivery_routes')
    .insert({
      name: params.name,
      description: params.description || null,
      driver_id: params.driverId || null,
      driver_name: params.driverName || null,
      scheduled_date: params.scheduledDate,
      notes: params.notes || null,
      created_by: params.createdBy,
      created_by_name: params.createdByName,
      status: 'PENDIENTE',
    })
    .select()
    .single()

  if (routeError) throw routeError

  if (params.stops.length > 0) {
    const stopsData = params.stops.map((stop, idx) => ({
      route_id: route.id,
      stop_order: idx + 1,
      type: stop.type,
      client_name: stop.client_name,
      address: stop.address,
      latitude: stop.latitude || null,
      longitude: stop.longitude || null,
      phone: stop.phone || null,
      notes: stop.notes || null,
      canastillas_qty: stop.canastillas_qty || 0,
      status: 'PENDIENTE',
    }))

    const { error: stopsError } = await supabase
      .from('delivery_route_stops')
      .insert(stopsData)

    if (stopsError) throw stopsError
  }

  return getRouteById(route.id) as Promise<DeliveryRoute>
}

export async function updateRouteStatus(
  routeId: string,
  status: string,
): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }

  if (status === 'EN_CURSO') updates.started_at = new Date().toISOString()
  if (status === 'COMPLETADA' || status === 'CANCELADA') updates.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('delivery_routes')
    .update(updates)
    .eq('id', routeId)

  if (error) throw error
}

export async function assignDriver(
  routeId: string,
  driverId: string,
  driverName: string,
): Promise<void> {
  const { error } = await supabase
    .from('delivery_routes')
    .update({ driver_id: driverId, driver_name: driverName, updated_at: new Date().toISOString() })
    .eq('id', routeId)

  if (error) throw error
}

// ========== PARADAS ==========

export async function updateStopStatus(
  stopId: string,
  status: string,
  extras?: { driver_notes?: string; driver_latitude?: number; driver_longitude?: number },
): Promise<void> {
  const updates: Record<string, unknown> = { status }

  if (status === 'LLEGADO') updates.arrived_at = new Date().toISOString()
  if (status === 'COMPLETADA' || status === 'OMITIDA') updates.completed_at = new Date().toISOString()
  if (extras?.driver_notes) updates.driver_notes = extras.driver_notes
  if (extras?.driver_latitude) updates.driver_latitude = extras.driver_latitude
  if (extras?.driver_longitude) updates.driver_longitude = extras.driver_longitude

  const { error } = await supabase
    .from('delivery_route_stops')
    .update(updates)
    .eq('id', stopId)

  if (error) throw error
}

// ========== TRACKING ==========

export async function addTrackingPoint(params: {
  routeId: string
  driverId: string
  latitude: number
  longitude: number
  speed?: number
  heading?: number
}): Promise<void> {
  const { error } = await supabase
    .from('route_tracking_points')
    .insert({
      route_id: params.routeId,
      driver_id: params.driverId,
      latitude: params.latitude,
      longitude: params.longitude,
      speed: params.speed || null,
      heading: params.heading || null,
    })

  if (error) throw error
}

export async function getTrackingPoints(routeId: string): Promise<RouteTrackingPoint[]> {
  const { data, error } = await supabase
    .from('route_tracking_points')
    .select('*')
    .eq('route_id', routeId)
    .order('recorded_at', { ascending: true })

  if (error) throw error
  return data || []
}

// ========== CONDUCTORES DISPONIBLES ==========

export async function getAvailableDrivers(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .eq('role', 'conductor')
    .eq('is_active', true)
    .order('first_name')

  if (error) throw error
  return (data || []).map(u => ({
    id: u.id,
    name: `${u.first_name} ${u.last_name || ''}`.trim(),
  }))
}
