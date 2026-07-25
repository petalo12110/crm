export class AppError extends Error {
  constructor(
    public readonly message:    string,
    public readonly statusCode: number,
    public readonly errorCode:  string,
    public readonly details?:   Array<{ field?: string; message: string }>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Validation failed',
    details?: Array<{ field?: string; message: string }>
  ) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT')
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    message: string,
    details?: Array<{ field?: string; message: string }>
  ) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', details)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds?: number) {
    super(
      'Too many requests',
      429,
      'RATE_LIMITED',
      retryAfterSeconds ? [{ message: `Retry after ${retryAfterSeconds} seconds` }] : undefined
    )
  }
}
