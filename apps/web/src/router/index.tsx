import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AuthLayout }      from '@/layouts/AuthLayout'
import { AdminAuthLayout } from '@/layouts/AdminAuthLayout'
import { AdminLayout }     from '@/layouts/AdminLayout'
import { PortalAuthLayout } from '@/layouts/PortalAuthLayout'
import { PortalLayout }     from '@/layouts/PortalLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { ProtectedRoute }      from './ProtectedRoute'
import { AdminProtectedRoute } from './AdminProtectedRoute'
import { PortalProtectedRoute } from './PortalProtectedRoute'
import { GuestRoute }           from './GuestRoute'

import { LoginPage }          from '@/features/auth/pages/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage }  from '@/features/auth/pages/ResetPasswordPage'
import { AdminLoginPage }     from '@/features/admin/pages/AdminLoginPage'

import { DashboardPage }      from '@/features/dashboard/pages/DashboardPage'
import { CustomersPage }      from '@/features/customers/pages/CustomersPage'
import { CustomerDetailPage } from '@/features/customers/pages/CustomerDetailPage'
import { LeadsPage }          from '@/features/leads/pages/LeadsPage'
import { LeadDetailPage }     from '@/features/leads/pages/LeadDetailPage'
import { OpportunitiesPage }  from '@/features/opportunities/pages/OpportunitiesPage'
import { TasksPage }          from '@/features/tasks/pages/TasksPage'
import { TicketsPage }        from '@/features/tickets/pages/TicketsPage'
import { TicketDetailPage }   from '@/features/tickets/pages/TicketDetailPage'
import { CalendarPage }       from '@/features/calendar/pages/CalendarPage'
import { EmployeesPage }      from '@/features/employees/pages/EmployeesPage'
import { ReportsPage }        from '@/features/reports/pages/ReportsPage'
import { SettingsPage }       from '@/features/settings/pages/SettingsPage'
import { SuperAdminPage }     from '@/features/admin/pages/SuperAdminPage'
import { PortalLoginPage }        from '@/features/portal/pages/PortalLoginPage'
import { PortalVerifyPage }       from '@/features/portal/pages/PortalVerifyPage'
import { PortalTicketsPage }      from '@/features/portal/pages/PortalTicketsPage'
import { PortalTicketDetailPage } from '@/features/portal/pages/PortalTicketDetailPage'

const NotFound = (
  <div className="flex h-full flex-col items-center justify-center gap-2 py-24">
    <p className="text-2xl font-bold text-text-primary">404</p>
    <p className="text-text-secondary">Page not found</p>
  </div>
)

export const router = createBrowserRouter([
  // ── Company login (tenant users) ──────────────────────────
  {
    element: <AuthLayout />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
        ],
      },
      // Deliberately NOT behind GuestRoute — see GuestRoute.tsx for why.
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password',  element: <ResetPasswordPage /> },
    ],
  },

  // ── Company CRM (tenant users) ─────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/',                element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard',       element: <DashboardPage /> },
          { path: '/customers',       element: <CustomersPage /> },
          { path: '/customers/:id',   element: <CustomerDetailPage /> },
          { path: '/leads',           element: <LeadsPage /> },
          { path: '/leads/:id',       element: <LeadDetailPage /> },
          { path: '/opportunities',   element: <OpportunitiesPage /> },
          { path: '/tasks',           element: <TasksPage /> },
          { path: '/tickets',         element: <TicketsPage /> },
          { path: '/tickets/:id',     element: <TicketDetailPage /> },
          { path: '/calendar',        element: <CalendarPage /> },
          { path: '/employees',       element: <EmployeesPage /> },
          { path: '/reports',         element: <ReportsPage /> },
          { path: '/settings',        element: <SettingsPage /> },
          { path: '*', element: NotFound },
        ],
      },
    ],
  },

  // ── Platform Super Admin — entirely separate tree ─────────
  // Own login page, own layout, own guard. Never nested under the
  // company CRM's DashboardLayout/ProtectedRoute/Sidebar at all.
  {
    element: <AdminAuthLayout />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: '/admin/login', element: <AdminLoginPage /> },
        ],
      },
    ],
  },
  {
    element: <AdminProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <SuperAdminPage /> },
          { path: '/admin/*', element: <Navigate to="/admin" replace /> },
        ],
      },
    ],
  },

  // ── Customer Self-Service Portal — per-company, own auth ──
  // Magic-link login (no password), scoped by :companySlug in the URL so
  // customers never need to know/paste a company UUID like tenant users
  // do. Entirely separate from both the tenant CRM and Super Admin trees.
  {
    element: <PortalAuthLayout />,
    children: [
      { path: '/portal/:companySlug/login',  element: <PortalLoginPage /> },
      { path: '/portal/:companySlug/verify', element: <PortalVerifyPage /> },
    ],
  },
  {
    element: <PortalProtectedRoute />,
    children: [
      {
        element: <PortalLayout />,
        children: [
          { path: '/portal/:companySlug/tickets',     element: <PortalTicketsPage /> },
          { path: '/portal/:companySlug/tickets/:id', element: <PortalTicketDetailPage /> },
        ],
      },
    ],
  },

  { path: '*', element: NotFound },
])
