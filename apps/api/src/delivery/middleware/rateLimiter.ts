import rateLimit from 'express-rate-limit'

/** Global API rate limit — 300 requests per minute per IP */
export const rateLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              300,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: {
      code:    'RATE_LIMITED',
      message: 'Too many requests, please slow down.',
    },
  },
})

/** Strict auth rate limit — 20 requests per 15 minutes per IP */
export const authRateLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: {
    success: false,
    error: {
      code:    'RATE_LIMITED',
      message: 'Too many login attempts. Please try again later.',
    },
  },
})
