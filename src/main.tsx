/**
 * @module main
 * @description Punto de entrada de la aplicación React.
 * Monta el componente App dentro de React.StrictMode y el proveedor de tema (ThemeProvider).
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)