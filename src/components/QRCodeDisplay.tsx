import QRCode from 'react-qr-code'

interface QRCodeDisplayProps {
  value: string
  size?: number
  title?: string
}

export function QRCodeDisplay({ value, size = 200, title }: QRCodeDisplayProps) {
  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    canvas.width = size
    canvas.height = size

    img.onload = () => {
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL('image/png')
      
      const downloadLink = document.createElement('a')
      downloadLink.download = `QR-${value}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      )}
      
      <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-sm">
        <QRCode
          id="qr-code-svg"
          value={value}
          size={size}
          level="H"
        />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-gray-900 mb-1">{value}</p>
        <button
          onClick={handleDownload}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Descargar QR</span>
        </button>
      </div>
    </div>
  )
}