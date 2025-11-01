'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type TenantOption = { id: string; name: string }

export default function TenantSwitcher({ currentTenantId, tenants }: { currentTenantId: string; tenants: TenantOption[] }) {
  const router = useRouter()
  const [value, setValue] = useState(currentTenantId)

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tid = e.target.value
    setValue(tid)
    try {
      localStorage.setItem('lastTenantId', tid)
    } catch {}
    router.push(`/t/${tid}`)
  }

  if (!tenants || tenants.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tenant-switcher" className="text-sm text-gray-600">Tenant</label>
      <select
        id="tenant-switcher"
        value={value}
        onChange={onChange}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {tenants.map(t => (
          <option key={t.id} value={t.id}>{t.name || t.id}</option>
        ))}
      </select>
    </div>
  )
}
