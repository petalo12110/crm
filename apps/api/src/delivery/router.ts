import { Router } from 'express'
import { authRouter }            from '../modules/auth/auth.routes'
import { companiesRouter }       from '../modules/companies/companies.routes'
import { customersRouter }       from '../modules/customers/customers.routes'
import { leadsRouter }           from '../modules/leads/leads.routes'
import { opportunitiesRouter }   from '../modules/opportunities/opportunities.routes'
import { ticketsRouter }         from '../modules/tickets/tickets.routes'
import { tasksRouter }           from '../modules/tasks/tasks.routes'
import { calendarRouter }        from '../modules/calendar/calendar.routes'
import { notificationsRouter }   from '../modules/notifications/notifications.routes'
import { documentsRouter }       from '../modules/documents/documents.routes'
import { employeesRouter }       from '../modules/employees/employees.routes'
import { settingsRouter }        from '../modules/settings/settings.routes'
import { auditRouter }           from '../modules/audit/audit.routes'
import { searchRouter }          from '../modules/search/search.routes'
import { dashboardRouter }       from '../modules/reports/dashboard.routes'
import { adminRouter }           from '../modules/admin/admin.routes'
import { portalRouter }          from '../modules/portal/portal.routes'

export const router: Router = Router()

router.use('/auth',          authRouter)
router.use('/companies',     companiesRouter)
router.use('/customers',     customersRouter)
router.use('/leads',         leadsRouter)
router.use('/opportunities', opportunitiesRouter)
router.use('/tickets',       ticketsRouter)
router.use('/tasks',         tasksRouter)
router.use('/calendar',      calendarRouter)
router.use('/notifications', notificationsRouter)
router.use('/documents',     documentsRouter)
router.use('/employees',     employeesRouter)
router.use('/settings',      settingsRouter)
router.use('/audit',         auditRouter)
router.use('/search',        searchRouter)
router.use('/dashboard',     dashboardRouter)
router.use('/admin',         adminRouter)
router.use('/portal',        portalRouter)
