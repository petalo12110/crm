export const UserRole = {
  SUPER_ADMIN:    'SUPER_ADMIN',
  COMPANY_OWNER:  'COMPANY_OWNER',
  MANAGER:        'MANAGER',
  SALES_REP:      'SALES_REP',
  SUPPORT:        'SUPPORT',
  EMPLOYEE:       'EMPLOYEE',
  CUSTOMER:       'CUSTOMER',
} as const
export type UserRole = typeof UserRole[keyof typeof UserRole]

export const LeadStage = {
  NEW:           'NEW',
  CONTACTED:     'CONTACTED',
  QUALIFIED:     'QUALIFIED',
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  NEGOTIATION:   'NEGOTIATION',
  WON:           'WON',
  LOST:          'LOST',
  ARCHIVED:      'ARCHIVED',
} as const
export type LeadStage = typeof LeadStage[keyof typeof LeadStage]

// Valid forward transitions for the lead pipeline
export const LEAD_STAGE_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW:           ['CONTACTED', 'QUALIFIED', 'LOST', 'ARCHIVED'],
  CONTACTED:     ['QUALIFIED', 'LOST', 'ARCHIVED'],
  QUALIFIED:     ['PROPOSAL_SENT', 'LOST', 'ARCHIVED'],
  PROPOSAL_SENT: ['NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'],
  NEGOTIATION:   ['WON', 'LOST', 'ARCHIVED'],
  WON:           ['ARCHIVED'],
  LOST:          ['NEW', 'ARCHIVED'],
  ARCHIVED:      ['NEW'],
}

export const OpportunityStage = {
  PROSPECTING:      'PROSPECTING',
  QUALIFICATION:    'QUALIFICATION',
  NEEDS_ANALYSIS:   'NEEDS_ANALYSIS',
  VALUE_PROPOSITION:'VALUE_PROPOSITION',
  DECISION_MAKERS:  'DECISION_MAKERS',
  PROPOSAL:         'PROPOSAL',
  NEGOTIATION:      'NEGOTIATION',
  CLOSED_WON:       'CLOSED_WON',
  CLOSED_LOST:      'CLOSED_LOST',
} as const
export type OpportunityStage = typeof OpportunityStage[keyof typeof OpportunityStage]

export const TaskPriority = {
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
  URGENT: 'URGENT',
} as const
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority]

export const TaskStatus = {
  OPEN:        'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED:   'COMPLETED',
  CANCELLED:   'CANCELLED',
} as const
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus]

export const TicketPriority = {
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
} as const
export type TicketPriority = typeof TicketPriority[keyof typeof TicketPriority]

export const TicketStatus = {
  OPEN:        'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD:     'ON_HOLD',
  RESOLVED:    'RESOLVED',
  CLOSED:      'CLOSED',
} as const
export type TicketStatus = typeof TicketStatus[keyof typeof TicketStatus]

export const TimelineEntryType = {
  EMAIL:        'EMAIL',
  CALL:         'CALL',
  SMS:          'SMS',
  NOTE:         'NOTE',
  MEETING:      'MEETING',
  TICKET:       'TICKET',
  PURCHASE:     'PURCHASE',
  INVOICE:      'INVOICE',
  STAGE_CHANGE: 'STAGE_CHANGE',
  ASSIGNMENT:   'ASSIGNMENT',
  SYSTEM:       'SYSTEM',
} as const
export type TimelineEntryType = typeof TimelineEntryType[keyof typeof TimelineEntryType]

export const NotificationType = {
  TASK_ASSIGNED:      'TASK_ASSIGNED',
  TASK_DUE:           'TASK_DUE',
  TICKET_ASSIGNED:    'TICKET_ASSIGNED',
  TICKET_UPDATED:     'TICKET_UPDATED',
  LEAD_STAGE_CHANGED: 'LEAD_STAGE_CHANGED',
  MENTION:            'MENTION',
  CALENDAR_REMINDER:  'CALENDAR_REMINDER',
  SYSTEM:             'SYSTEM',
} as const
export type NotificationType = typeof NotificationType[keyof typeof NotificationType]

export const AuditAction = {
  CREATE:            'CREATE',
  UPDATE:            'UPDATE',
  DELETE:            'DELETE',
  LOGIN:             'LOGIN',
  LOGOUT:            'LOGOUT',
  PASSWORD_RESET:    'PASSWORD_RESET',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  SETTINGS_CHANGE:   'SETTINGS_CHANGE',
  FILE_UPLOAD:       'FILE_UPLOAD',
  FILE_DELETE:       'FILE_DELETE',
  EXPORT:            'EXPORT',
} as const
export type AuditAction = typeof AuditAction[keyof typeof AuditAction]

export const PlanTier = {
  FREE:         'FREE',
  STARTER:      'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE:   'ENTERPRISE',
} as const
export type PlanTier = typeof PlanTier[keyof typeof PlanTier]
