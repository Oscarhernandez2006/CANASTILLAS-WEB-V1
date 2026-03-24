interface DateFilterProps {
  selected: string
  onChange: (period: string) => void
}

export function DateFilter({ selected, onChange }: DateFilterProps) {
  const periods = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'custom', label: 'Personalizado' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
            selected === period.value
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}