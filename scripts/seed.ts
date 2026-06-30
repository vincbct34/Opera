/**
 * Development seed script.
 * Populates the (otherwise empty) dev database with realistic test data:
 * admin + regular users, addresses, institutions, events and registrations.
 *
 * Run with:  npx tsx scripts/seed.ts
 *
 * Idempotent-ish: users are upserted by email; events/institutions are only
 * created when the DB looks empty (guarded by --force to wipe & re-seed).
 */

import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

faker.seed(2026); // deterministic data across runs

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Same policy as lib/validation/validationSchemas.ts (min 10, upper/lower/digit/special).
const TEST_PASSWORD = 'TestOpera2026!';

const PUBLIC_CATEGORIES = [
  'CRECHE',
  'MATERNELLE',
  'ELEMENTAIRE',
  'COLLEGE',
  'LYCEE',
  'SUPERIEUR',
  'CONSERVATOIRE',
  'ASSOCIATION',
] as const;

const EVENT_TYPES = [
  'OPERA',
  'SYMPHONIQUE',
  'CHAMBRE_BAROQUE',
  'EN_FAMILLE',
  'OPERA_JUNIOR',
  'CONCERT_LYRIQUE',
  'DANSE',
  'ATELIER',
] as const;

function pickSome<T>(arr: readonly T[], min = 1, max = 2): T[] {
  const n = faker.number.int({ min, max: Math.min(max, arr.length) });
  return faker.helpers.arrayElements(arr as T[], n);
}

async function main() {
  const force = process.argv.includes('--force');

  if (force) {
    console.log('--force: wiping existing data…');
    // Delete in FK-safe order.
    await prisma.registrationDisability.deleteMany();
    await prisma.groupDisability.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.eventAccessibility.deleteMany();
    await prisma.scoringCriterion.deleteMany();
    await prisma.scoringConfiguration.deleteMany();
    await prisma.event.deleteMany();
    await prisma.userInstitution.deleteMany();
    await prisma.adminNote.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.passwordHistory.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.group.deleteMany();
    await prisma.institution.deleteMany();
    await prisma.address.deleteMany();
    await prisma.user.deleteMany();
  }

  const existing = await prisma.user.count();
  if (existing > 0 && !force) {
    console.log(`DB already has ${existing} users. Use --force to wipe & re-seed. Aborting.`);
    return;
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // ---- Users (fixed accounts you can log in with) -------------------------
  const fixedUsers = [
    {
      email: 'superadmin@oonm.fr',
      last_name: 'Super',
      first_name: 'Admin',
      role: 'SUPERADMIN' as const,
    },
    {
      email: 'admin@oonm.fr',
      last_name: 'Champroux',
      first_name: 'Mathilde',
      role: 'ADMIN' as const,
    },
    { email: 'prof@oonm.fr', last_name: 'Dupont', first_name: 'Claire', role: 'USER' as const },
  ];

  const users = [];
  for (const u of fixedUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: passwordHash,
        last_name: u.last_name,
        first_name: u.first_name,
        phone_number: faker.phone.number({ style: 'national' }),
        role: u.role,
      },
    });
    users.push(user);
  }

  // ---- Random extra teacher users ----------------------------------------
  for (let i = 0; i < 7; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase(),
        password: passwordHash,
        first_name: first,
        last_name: last,
        phone_number: faker.phone.number({ style: 'national' }),
        role: 'USER',
      },
    });
    users.push(user);
  }
  console.log(`Created ${users.length} users (login password for all: ${TEST_PASSWORD})`);

  // ---- Institutions (each behind an Address) ------------------------------
  const institutions = [];
  for (let i = 0; i < 8; i++) {
    const address = await prisma.address.create({
      data: {
        street: faker.location.streetAddress(),
        zip_code: faker.location.zipCode('34###'),
        city: faker.helpers.arrayElement([
          'Montpellier',
          'Lattes',
          'Castelnau-le-Lez',
          'Sète',
          'Lunel',
        ]),
      },
    });
    const institution = await prisma.institution.create({
      data: {
        name: `${faker.helpers.arrayElement(['École', 'Collège', 'Lycée', 'Conservatoire'])} ${faker.person.lastName()}`,
        email: faker.internet.email().toLowerCase(),
        phone_number: faker.phone.number({ style: 'national' }),
        address_id: address.id,
        is_rep: faker.datatype.boolean(0.3),
        type: pickSome(PUBLIC_CATEGORIES, 1, 2),
      },
    });
    institutions.push(institution);
  }
  console.log(`Created ${institutions.length} institutions`);

  // ---- Link users <-> institutions ----------------------------------------
  for (const user of users.filter((u) => u.role === 'USER')) {
    const inst = faker.helpers.arrayElement(institutions);
    await prisma.userInstitution.create({
      data: { user_id: user.id, institution_id: inst.id },
    });
  }

  // ---- Events --------------------------------------------------------------
  const eventTitles = [
    'Carmen',
    'La Flûte enchantée',
    'Casse-Noisette',
    'Concert symphonique Beethoven',
    'Opéra Junior : Le Petit Prince',
    "Atelier découverte de l'orchestre",
  ];
  const events = [];
  for (const title of eventTitles) {
    const futureDates = Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () =>
      faker.date.between({ from: '2026-09-01', to: '2027-06-30' }),
    );
    const total = faker.number.int({ min: 80, max: 400 });
    const event = await prisma.event.create({
      data: {
        title,
        description: faker.lorem.paragraph(),
        type: pickSome(EVENT_TYPES, 1, 2),
        location: faker.helpers.arrayElement(['Opéra Comédie', 'Opéra Berlioz', 'Salle Molière']),
        duration: faker.number.int({ min: 45, max: 150 }),
        total_seats: total,
        booked_seats: 0,
        event_dates: futureDates,
        category: pickSome(PUBLIC_CATEGORIES, 1, 3),
        slug: faker.helpers.slugify(title).toLowerCase(),
        has_initial_formation: faker.datatype.boolean(0.4),
      },
    });
    events.push(event);
  }
  console.log(`Created ${events.length} events`);

  // ---- Registrations -------------------------------------------------------
  let regCount = 0;
  for (const user of users.filter((u) => u.role === 'USER')) {
    const link = await prisma.userInstitution.findFirst({ where: { user_id: user.id } });
    if (!link) continue;
    const chosenEvents = faker.helpers.arrayElements(events, faker.number.int({ min: 1, max: 3 }));
    for (const event of chosenEvents) {
      const seats = faker.number.int({ min: 5, max: 30 });
      await prisma.registration.create({
        data: {
          user_id: user.id,
          institution_id: link.institution_id,
          event_id: event.id,
          date: faker.helpers.arrayElement(event.event_dates),
          booked_seats: seats,
          status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'CONFIRMED']),
          category: pickSome(PUBLIC_CATEGORIES, 1, 1),
        },
      });
      await prisma.event.update({
        where: { id: event.id },
        data: { booked_seats: { increment: seats } },
      });
      regCount++;
    }
  }
  console.log(`Created ${regCount} registrations`);

  console.log('\nSeed complete. Login accounts:');
  console.log('  superadmin@oonm.fr / ' + TEST_PASSWORD + '  (SUPERADMIN)');
  console.log('  admin@oonm.fr      / ' + TEST_PASSWORD + '  (ADMIN)');
  console.log('  prof@oonm.fr       / ' + TEST_PASSWORD + '  (USER)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
