import { Outlet } from 'react-router-dom'
import { Sidebar }    from '@/components/layout/Sidebar'
import { Topbar }     from '@/components/layout/Topbar'
import { Breadcrumb } from '@/components/layout/Breadcrumb'

export function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <Breadcrumb />
        {/* pb-16 on mobile to account for bottom nav bar height */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
