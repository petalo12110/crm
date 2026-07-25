// Global test setup
process.env.NODE_ENV      = 'test'
process.env.DATABASE_URL  = 'postgresql://crm_test:crm_test@localhost:5432/crm_test'
process.env.REDIS_URL     = 'redis://localhost:6379/1'
process.env.JWT_SECRET    = 'test-secret-key-minimum-32-characters-long-for-testing'
process.env.ENCRYPTION_KEY= 'a'.repeat(64)
process.env.FRONTEND_URL  = 'http://localhost:5173'
process.env.LOG_LEVEL     = 'error'
