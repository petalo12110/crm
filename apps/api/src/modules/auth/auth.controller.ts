import { Request, Response, NextFunction } from 'express'
import { AuthService }     from './auth.service'
import { ValidationError } from '../../core/errors'
import {
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  UpdateProfileSchema,
} from '@crm/shared'

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // companyId comes from a required header or query param
      const companyId = req.headers['x-company-id'] as string
      if (!companyId) throw new ValidationError('X-Company-ID header is required')

      const dto    = LoginSchema.parse(req.body)
      const result = await this.service.login(dto, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }, companyId)
      res.json({ success: true, data: result })
    } catch (err) { next(err) }
  }

  // Platform Super Admin — no X-Company-ID at all, this is not a company
  // login. Kept as a fully separate method/route rather than a branch of
  // login() above, so the two audiences can never be confused server-side.
  adminLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto    = LoginSchema.parse(req.body)
      const result = await this.service.adminLogin(dto, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      res.json({ success: true, data: result })
    } catch (err) { next(err) }
  }

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto    = RefreshSchema.parse(req.body)
      const result = await this.service.refresh(dto, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      })
      res.json({ success: true, data: result })
    } catch (err) { next(err) }
  }

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body
      if (refreshToken) {
        await this.service.logout(refreshToken, req.user.id, req.user.companyId)
      }
      res.json({ success: true })
    } catch (err) { next(err) }
  }

  logoutAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.logoutAll(req.user.id, req.user.companyId)
      res.json({ success: true })
    } catch (err) { next(err) }
  }

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ForgotPasswordSchema.parse(req.body)
      await this.service.forgotPassword(dto)
      res.json({ success: true, data: { message: 'If that email exists, a reset link has been sent.' } })
    } catch (err) { next(err) }
  }

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ResetPasswordSchema.parse(req.body)
      await this.service.resetPassword(dto)
      res.json({ success: true, data: { message: 'Password updated successfully.' } })
    } catch (err) { next(err) }
  }

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: req.user })
    } catch (err) { next(err) }
  }

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto  = UpdateProfileSchema.parse(req.body)
      const user = await this.service.updateProfile(req.user.id, dto)
      res.json({ success: true, data: user })
    } catch (err) { next(err) }
  }

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = ChangePasswordSchema.parse(req.body)
      await this.service.changePassword(req.user.id, req.user.companyId, dto)
      res.json({ success: true, data: { message: 'Password changed. Please log in again.' } })
    } catch (err) { next(err) }
  }
}
