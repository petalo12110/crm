import { Router }           from 'express'
import { AuthController }   from './auth.controller'
import { AuthService }      from './auth.service'
import { AuthRepository }   from './auth.repository'
import { AuditService }     from '../audit/audit.service'
import { authenticate }     from '../../delivery/middleware/authenticate'
import { authRateLimiter }  from '../../delivery/middleware/rateLimiter'

const router     : import("express").Router = Router()
const service    = new AuthService(new AuthRepository(), new AuditService())
const controller = new AuthController(service)

// Public routes — apply strict rate limiting
router.post('/login',           authRateLimiter, controller.login)
router.post('/admin/login',     authRateLimiter, controller.adminLogin)
router.post('/refresh',         authRateLimiter, controller.refresh)
router.post('/forgot-password', authRateLimiter, controller.forgotPassword)
router.post('/reset-password',  authRateLimiter, controller.resetPassword)

// Authenticated routes
router.post('/logout',          authenticate, controller.logout)
router.post('/logout-all',      authenticate, controller.logoutAll)
router.get( '/me',              authenticate, controller.me)
router.patch('/me',             authenticate, controller.updateMe)
router.patch('/me/password',    authenticate, controller.changePassword)

export { router as authRouter }
