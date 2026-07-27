export interface SmtpPreset {
  label: string
  host: string
  port: number
  secure: boolean
}

export const SMTP_PROVIDER_PRESETS: SmtpPreset[] = [
  { label: 'Custom / other',          host: '',                   port: 587,  secure: false },
  { label: 'Mailpit (local dev)',     host: 'localhost',           port: 1025, secure: false },
  { label: 'Gmail',                   host: 'smtp.gmail.com',      port: 587,  secure: false },
  { label: 'SendGrid (port 2525)',    host: 'smtp.sendgrid.net',   port: 2525, secure: false },
  { label: 'Mailgun',                 host: 'smtp.mailgun.org',    port: 587,  secure: false },
  { label: 'Resend',                  host: 'smtp.resend.com',     port: 587,  secure: false },
  { label: 'Outlook / Microsoft 365', host: 'smtp.office365.com',  port: 587,  secure: false },
  { label: 'Amazon SES (US East)',    host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false },
]
