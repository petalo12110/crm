import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱  Seeding database...')

  const passwordHash = await bcrypt.hash('Admin@12345', 12)

  // ── Super Admin ────────────────────────────────────────
  // Platform-level account: isSuperAdmin is a flag on User itself, not a
  // CompanyMember role — they don't belong to Acme or any other company.
  // Log in at /admin/login, not the regular company login page.
  const superAdmin = await prisma.user.upsert({
    where:  { email: 'superadmin@crm.local' },
    update: { isSuperAdmin: true },
    create: {
      email:     'superadmin@crm.local',
      firstName: 'Super',
      lastName:  'Admin',
      passwordHash,
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
    },
  })
  console.log('✅  Super admin:', superAdmin.email)

  // ── Company A — Acme Corp ──────────────────────────────
  const acme = await prisma.company.upsert({
    where:  { slug: 'acme-corp' },
    update: {},
    create: {
      name:     'Acme Corp',
      slug:     'acme-corp',
      email:    'admin@acme.example.com',
      timezone: 'Africa/Lusaka',
      currency: 'ZMW',
      country:  'ZM',
      subscription: {
        create: { planTier: 'PROFESSIONAL', status: 'ACTIVE', maxUsers: 50, maxCustomers: 5000 },
      },
    },
  })
  console.log('✅  Company:', acme.name)

  // ── Seed users for Acme ────────────────────────────────
  const seedUser = async (data: {
    email: string; firstName: string; lastName: string
    role: 'COMPANY_OWNER' | 'MANAGER' | 'SALES_REP' | 'SUPPORT' | 'EMPLOYEE'
  }) => {
    const user = await prisma.user.upsert({
      where:  { email: data.email },
      update: {},
      create: {
        email:          data.email,
        firstName:      data.firstName,
        lastName:       data.lastName,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    })
    await prisma.companyMember.upsert({
      where:  { companyId_userId: { companyId: acme.id, userId: user.id } },
      update: {},
      create: { companyId: acme.id, userId: user.id, role: data.role },
    })
    return user
  }

  await seedUser({ email: 'owner@acme.example.com',   firstName: 'Dave',   lastName: 'Posty',  role: 'COMPANY_OWNER' })
  const mgr  = await seedUser({ email: 'manager@acme.example.com',  firstName: 'Alice',  lastName: 'Smith',  role: 'MANAGER' })
  const rep1 = await seedUser({ email: 'sales1@acme.example.com',   firstName: 'Bob',    lastName: 'Mwale',  role: 'SALES_REP' })
  const rep2 = await seedUser({ email: 'sales2@acme.example.com',   firstName: 'Carol',  lastName: 'Phiri',  role: 'SALES_REP' })
  const sup  = await seedUser({ email: 'support@acme.example.com',  firstName: 'David',  lastName: 'Banda',  role: 'SUPPORT' })
  console.log('✅  Users seeded for Acme Corp')

  // ── Sample data (customers, leads, tickets, tasks, timeline) ──
  //
  // Unlike everything above, these use plain .create() rather than
  // .upsert() — there's no natural unique key to upsert most of them on.
  // Re-running the seed against a database that already has this sample
  // data would otherwise fail (tickets hit it first, since ticketNumber
  // is unique per company) or silently duplicate customers/leads/tasks.
  // Guard the whole block on whether Acme already has sample customers,
  // since they're all seeded together in one pass and depend on each
  // other (leads/tickets reference customer IDs, etc.).
  const existingSampleData = await prisma.customer.count({ where: { companyId: acme.id } })

  if (existingSampleData > 0) {
    console.log('↷  Sample data already exists for Acme Corp — skipping customers/leads/tickets/tasks/timeline')
  } else {
  // ── Sample customers ───────────────────────────────────
  const customerData = [
    { firstName: 'John',   lastName: 'Banda',   email: 'john.banda@example.com',   companyName: 'Banda Enterprises',  industry: 'Retail',   customerType: 'BUSINESS',    status: 'ACTIVE',   tags: ['vip', 'wholesale'] },
    { firstName: 'Mary',   lastName: 'Tembo',   email: 'mary.tembo@example.com',    companyName: 'Tembo Trading',      industry: 'Wholesale', customerType: 'BUSINESS',   status: 'ACTIVE',   tags: ['wholesale'] },
    { firstName: 'Peter',  lastName: 'Lungu',   email: 'peter.lungu@example.com',   companyName: null,                 industry: null,        customerType: 'INDIVIDUAL',  status: 'ACTIVE',   tags: [] },
    { firstName: 'Grace',  lastName: 'Mutale',  email: 'grace.mutale@example.com',  companyName: 'GM Solutions',       industry: 'Tech',      customerType: 'BUSINESS',    status: 'PROSPECT', tags: ['tech'] },
    { firstName: 'James',  lastName: 'Zulu',    email: 'james.zulu@example.com',    companyName: null,                 industry: null,        customerType: 'INDIVIDUAL',  status: 'ACTIVE',   tags: [] },
  ]

  const customers = []
  for (const c of customerData) {
    const customer = await prisma.customer.create({
      data: {
        companyId:    acme.id,
        ownerId:      mgr.id,
        assignedTo:   [rep1.id, rep2.id][Math.floor(Math.random() * 2)],
        country:      'ZM',
        city:         'Lusaka',
        ...c,
        companyName:  c.companyName ?? undefined,
      },
    })
    customers.push(customer)
  }
  console.log(`✅  ${customers.length} customers seeded`)

  // ── Sample leads ───────────────────────────────────────
  const leadStages = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const
  for (let i = 0; i < 10; i++) {
    const customer = customers[i % customers.length]
    await prisma.lead.create({
      data: {
        companyId:  acme.id,
        customerId: customer.id,
        ownerId:    mgr.id,
        assignedTo: [rep1.id, rep2.id][i % 2],
        title:      `Lead ${i + 1} — ${customer.firstName} ${customer.lastName}`,
        source:     ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'TRADE_FAIR'][i % 4],
        stage:      leadStages[i % leadStages.length] as never,
        value:      Math.floor(Math.random() * 50000) + 5000,
        probability:Math.floor(Math.random() * 80) + 10,
      },
    })
  }
  console.log('✅  Leads seeded')

  // ── Sample tickets ─────────────────────────────────────
  const ticketData = [
    { title: 'Cannot access account',     priority: 'HIGH',     category: 'Access' },
    { title: 'Invoice discrepancy',        priority: 'MEDIUM',   category: 'Billing' },
    { title: 'Slow response times',        priority: 'LOW',      category: 'Performance' },
    { title: 'Feature request: export',    priority: 'LOW',      category: 'Feature' },
    { title: 'Payment gateway error',      priority: 'CRITICAL', category: 'Payment' },
  ]
  for (let i = 0; i < ticketData.length; i++) {
    const t = ticketData[i]
    await prisma.ticket.create({
      data: {
        companyId:    acme.id,
        customerId:   customers[i % customers.length].id,
        createdBy:    sup.id,
        assignedTo:   sup.id,
        ticketNumber: `TKT-${String(i + 1).padStart(6, '0')}`,
        title:        t.title,
        priority:     t.priority as never,
        category:     t.category,
        status:       i === 3 ? 'RESOLVED' as never : 'OPEN' as never,
        slaDeadline:  new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
      },
    })
  }
  console.log('✅  Tickets seeded')

  // ── Sample tasks ───────────────────────────────────────
  const taskTitles = [
    'Follow up with John Banda', 'Prepare Q3 proposal', 'Send invoice to Tembo Trading',
    'Schedule demo for GM Solutions', 'Update CRM with meeting notes',
  ]
  for (let i = 0; i < taskTitles.length; i++) {
    await prisma.task.create({
      data: {
        companyId:  acme.id,
        createdBy:  mgr.id,
        assignedTo: [rep1.id, rep2.id, sup.id][i % 3],
        title:      taskTitles[i],
        priority:   ['LOW','MEDIUM','HIGH','URGENT'][i % 4] as never,
        status:     'OPEN' as never,
        dueDate:    new Date(Date.now() + (i + 1) * 2 * 24 * 60 * 60 * 1000),
      },
    })
  }
  console.log('✅  Tasks seeded')

  // ── Timeline entries for first customer ───────────────
  await prisma.timelineEntry.createMany({
    data: [
      { companyId: acme.id, customerId: customers[0].id, entryType: 'SYSTEM' as never,  direction: 'INTERNAL' as never, subject: 'Customer record created',             userId: mgr.id,  occurredAt: new Date(Date.now() - 30 * 86400000) },
      { companyId: acme.id, customerId: customers[0].id, entryType: 'CALL' as never,    direction: 'OUTBOUND' as never, subject: 'Initial discovery call',              userId: rep1.id, occurredAt: new Date(Date.now() - 20 * 86400000) },
      { companyId: acme.id, customerId: customers[0].id, entryType: 'EMAIL' as never,   direction: 'OUTBOUND' as never, subject: 'Sent product brochure',               userId: rep1.id, occurredAt: new Date(Date.now() - 15 * 86400000) },
      { companyId: acme.id, customerId: customers[0].id, entryType: 'MEETING' as never, direction: 'INBOUND' as never,  subject: 'In-person meeting at client office',  userId: rep1.id, occurredAt: new Date(Date.now() - 7 * 86400000)  },
      { companyId: acme.id, customerId: customers[0].id, entryType: 'NOTE' as never,    direction: 'INTERNAL' as never, subject: 'Decision expected by end of month',    userId: mgr.id,  occurredAt: new Date(Date.now() - 2 * 86400000)  },
    ],
  })
  console.log('✅  Timeline entries seeded')
  }

  console.log('\n🎉  Seed complete!')
  console.log(`\n🏢  Acme Corp company ID (paste into the login form's "Company ID" field): ${acme.id}`)
  console.log('\n📋  Test accounts (password for all: Admin@12345):')
  console.log('   superadmin@crm.local     — Super Admin — log in at /admin/login (no Company ID needed)')
  console.log('   owner@acme.example.com   — Company Owner (Acme Corp)')
  console.log('   manager@acme.example.com — Manager')
  console.log('   sales1@acme.example.com  — Sales Rep')
  console.log('   support@acme.example.com — Support')
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
