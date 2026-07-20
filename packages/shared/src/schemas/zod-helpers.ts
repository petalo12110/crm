import { z } from 'zod'

// A blank form field sends '' , not undefined/omitted — but
// z.string().email()/.url() reject '' even when the field is marked
// .optional(), since '' is still a present string value that fails the
// format check. Every optional email/url field in a form (website,
// company contact email, logo URL, etc.) hit this the same way: leaving
// it blank threw a validation error instead of being treated as "not
// provided". These helpers preprocess '' -> undefined before the format
// check runs, so blank really means blank.
function emptyStringToUndefined(v: unknown): unknown {
  return v === '' ? undefined : v
}

export function optionalEmail(opts: { max?: number; nullable?: boolean } = {}) {
  let inner = z.string().email('Invalid email address')
  if (opts.max) inner = inner.max(opts.max)
  const withMods = opts.nullable ? inner.optional().nullable() : inner.optional()
  return z.preprocess(emptyStringToUndefined, withMods)
}

export function optionalUrl(opts: { max?: number; nullable?: boolean } = {}) {
  let inner = z.string().url('Invalid URL')
  if (opts.max) inner = inner.max(opts.max)
  const withMods = opts.nullable ? inner.optional().nullable() : inner.optional()
  return z.preprocess(emptyStringToUndefined, withMods)
}
