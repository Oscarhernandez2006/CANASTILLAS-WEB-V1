import React, { createContext, useContext, useState, useCallback } from 'react'

interface InventarioContextType {
  coloresDisponibles: string[]
  tamanosDisponibles: string[]
  formasDisponibles: string[]
  condicionesDisponibles: string[]
  ubicacionesDisponibles: string[]
  areasDisponibles: string[]
  agregarColor: (color: string) => void
  agregarTamano: (tamano: string) => void
  agregarForma: (forma: string) => void
  agregarCondicion: (condicion: string) => void
  agregarUbicacion: (ubicacion: string) => void
  agregarArea: (area: string) => void
  actualizarAtributos: (tipo: string, atributos: string[]) => void
}

const InventarioContext = createContext<InventarioContextType | undefined>(undefined)

export function InventarioProvider({ children }: { children: React.ReactNode }) {
  const [coloresDisponibles, setColoresDisponibles] = useState<string[]>([])
  const [tamanosDisponibles, setTamanosDisponibles] = useState<string[]>([])
  const [formasDisponibles, setFormasDisponibles] = useState<string[]>([])
  const [condicionesDisponibles, setCondicionesDisponibles] = useState<string[]>([])
  const [ubicacionesDisponibles, setUbicacionesDisponibles] = useState<string[]>([])
  const [areasDisponibles, setAreasDisponibles] = useState<string[]>([])

  const agregarColor = useCallback((color: string) => {
    setColoresDisponibles(prev => {
      if (!prev.includes(color)) {
        return [...prev, color].sort()
      }
      return prev
    })
  }, [])

  const agregarTamano = useCallback((tamano: string) => {
    setTamanosDisponibles(prev => {
      if (!prev.includes(tamano)) {
        return [...prev, tamano].sort()
      }
      return prev
    })
  }, [])

  const agregarForma = useCallback((forma: string) => {
    setFormasDisponibles(prev => {
      if (!prev.includes(forma)) {
        return [...prev, forma].sort()
      }
      return prev
    })
  }, [])

  const agregarCondicion = useCallback((condicion: string) => {
    setCondicionesDisponibles(prev => {
      if (!prev.includes(condicion)) {
        return [...prev, condicion].sort()
      }
      return prev
    })
  }, [])

  const agregarUbicacion = useCallback((ubicacion: string) => {
    setUbicacionesDisponibles(prev => {
      if (!prev.includes(ubicacion)) {
        return [...prev, ubicacion].sort()
      }
      return prev
    })
  }, [])

  const agregarArea = useCallback((area: string) => {
    setAreasDisponibles(prev => {
      if (!prev.includes(area)) {
        return [...prev, area].sort()
      }
      return prev
    })
  }, [])

  const actualizarAtributos = useCallback((tipo: string, atributos: string[]) => {
    switch (tipo) {
      case 'COLOR':
        setColoresDisponibles(atributos.sort())
        break
      case 'SIZE':
        setTamanosDisponibles(atributos.sort())
        break
      case 'FORMA':
        setFormasDisponibles(atributos.sort())
        break
      case 'CONDICION':
        setCondicionesDisponibles(atributos.sort())
        break
      case 'UBICACION':
        setUbicacionesDisponibles(atributos.sort())
        break
      case 'AREA':
        setAreasDisponibles(atributos.sort())
        break
    }
  }, [])

  return (
    <InventarioContext.Provider
      value={{
        coloresDisponibles,
        tamanosDisponibles,
        formasDisponibles,
        condicionesDisponibles,
        ubicacionesDisponibles,
        areasDisponibles,
        agregarColor,
        agregarTamano,
        agregarForma,
        agregarCondicion,
        agregarUbicacion,
        agregarArea,
        actualizarAtributos,
      }}
    >
      {children}
    </InventarioContext.Provider>
  )
}

export function useInventarioContext() {
  const context = useContext(InventarioContext)
  if (!context) {
    throw new Error('useInventarioContext debe usarse dentro de InventarioProvider')
  }
  return context
}