import { PrismaClient, ListingStatus, MessageAuthorRole, MessageState, ReservationStatus, ReservationSource } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const owner = await prisma.user.upsert({
    where: { clerkUserId: 'user_demo_owner_001' },
    update: {},
    create: {
      clerkUserId: 'user_demo_owner_001',
      email: 'owner@indiehost.local',
      firstName: 'Delphine',
      lastName: 'Demo',
      role: 'HOST',
      billingProfile: {
        stripeConnect: {
          accountId: 'acct_demo_owner_001',
          onboardingStatus: 'completed',
          chargesEnabled: true,
          payoutsEnabled: true,
        },
      },
    },
  })

  const listing = await prisma.listing.upsert({
    where: { publicId: '53028879' },
    update: {
      ownerId: owner.id,
      status: ListingStatus.ACTIVE,
      hasPendingChanges: false,
    },
    create: {
      publicId: '53028879',
      ownerId: owner.id,
      status: ListingStatus.ACTIVE,
      hasPendingChanges: false,
    },
  })

  await prisma.listingCore.upsert({
    where: { listingId: listing.id },
    update: {
      data: {
        id: '53028879',
        status: 'active',
        title: 'Maison flottante / Houseboat',
        city: 'Baurech',
        region: 'Nouvelle-Aquitaine',
        country: 'France',
        guest_capacity: 3,
      },
    },
    create: {
      listingId: listing.id,
      data: {
        id: '53028879',
        status: 'active',
        title: 'Maison flottante / Houseboat',
        city: 'Baurech',
        region: 'Nouvelle-Aquitaine',
        country: 'France',
        guest_capacity: 3,
      },
    },
  })

  await prisma.listingBookings.upsert({
    where: { listingId: listing.id },
    update: {
      data: {
        price: 174,
        fees: [{ name: 'Frais de ménage', amount: 35 }],
        'booked-days': [{ start: '2026-04-07', end: '2026-04-11' }],
        reservations: [],
      },
    },
    create: {
      listingId: listing.id,
      data: {
        price: 174,
        fees: [{ name: 'Frais de ménage', amount: 35 }],
        'booked-days': [{ start: '2026-04-07', end: '2026-04-11' }],
        reservations: [],
      },
    },
  })

  await prisma.listingMedias.upsert({
    where: { listingId: listing.id },
    update: {
      data: {
        images: [{ src: '/assets/media/images/listing-test-0/image0.jpg', alt: 'Vue lac', position: 0 }],
        videos: [],
      },
    },
    create: {
      listingId: listing.id,
      data: {
        images: [{ src: '/assets/media/images/listing-test-0/image0.jpg', alt: 'Vue lac', position: 0 }],
        videos: [],
      },
    },
  })

  await prisma.listingArrival.upsert({
    where: { listingId: listing.id },
    update: {
      data: {
        intro: { title: 'Bienvenue', subtitle: 'Guide d’arrivée', tagline: 'Propulsé par IndieHost' },
        practical: {
          access: {
            address: 'Baurech, Nouvelle-Aquitaine',
            checkIn: 'À partir de 16h',
            checkOut: 'Avant 11h',
          },
        },
      },
    },
    create: {
      listingId: listing.id,
      data: {
        intro: { title: 'Bienvenue', subtitle: 'Guide d’arrivée', tagline: 'Propulsé par IndieHost' },
        practical: {
          access: {
            address: 'Baurech, Nouvelle-Aquitaine',
            checkIn: 'À partir de 16h',
            checkOut: 'Avant 11h',
          },
        },
      },
    },
  })

  await prisma.listingNotes.upsert({
    where: { listingId: listing.id },
    update: { data: { note: { note: 4.95, distribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 48 } } } },
    create: { listingId: listing.id, data: { note: { note: 4.95, distribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 48 } } } },
  })

  await prisma.listingComments.upsert({
    where: { listingId: listing.id },
    update: { data: { comments: [[{ name: 'Camille', note: 5, comment: 'Séjour parfait.' }]] } },
    create: { listingId: listing.id, data: { comments: [[{ name: 'Camille', note: 5, comment: 'Séjour parfait.' }]] } },
  })

  await prisma.listingHost.upsert({
    where: { listingId: listing.id },
    update: {
      data: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
      },
    },
    create: {
      listingId: listing.id,
      data: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
      },
    },
  })

  const reservation = await prisma.reservation.upsert({
    where: { publicId: 'reservation-listing-53028879-2026-04-07-2026-04-11' },
    update: {
      listingId: listing.id,
      startDate: new Date('2026-04-07T00:00:00.000Z'),
      endDate: new Date('2026-04-11T00:00:00.000Z'),
      nights: 4,
      guestName: 'Clara Garcia',
      guestMessage: 'Séjour anniversaire',
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.DIRECT,
      guests: { adults: 2, children: 0, infants: 0, pets: 0, pmr: 0 },
      payment: { total: 731, deposit: 731, balance: 0, status: 'paid', method: 'Carte' },
      contact: { firstName: 'Clara', lastName: 'Garcia', email: 'clara@example.com' },
    },
    create: {
      publicId: 'reservation-listing-53028879-2026-04-07-2026-04-11',
      listingId: listing.id,
      startDate: new Date('2026-04-07T00:00:00.000Z'),
      endDate: new Date('2026-04-11T00:00:00.000Z'),
      nights: 4,
      guestName: 'Clara Garcia',
      guestMessage: 'Séjour anniversaire',
      status: ReservationStatus.CONFIRMED,
      source: ReservationSource.DIRECT,
      guests: { adults: 2, children: 0, infants: 0, pets: 0, pmr: 0 },
      payment: { total: 731, deposit: 731, balance: 0, status: 'paid', method: 'Carte' },
      contact: { firstName: 'Clara', lastName: 'Garcia', email: 'clara@example.com' },
    },
  })

  const conversation = await prisma.conversation.upsert({
    where: { publicId: '53028879::reservation-listing-53028879-2026-04-07-2026-04-11' },
    update: {
      listingId: listing.id,
      reservationId: reservation.id,
    },
    create: {
      publicId: '53028879::reservation-listing-53028879-2026-04-07-2026-04-11',
      listingId: listing.id,
      reservationId: reservation.id,
    },
  })

  await prisma.conversationParticipant.upsert({
    where: { id: `${conversation.id}:host:${owner.id}` },
    update: {
      role: 'HOST',
      userId: owner.id,
      displayName: 'Delphine',
    },
    create: {
      id: `${conversation.id}:host:${owner.id}`,
      conversationId: conversation.id,
      role: 'HOST',
      userId: owner.id,
      displayName: 'Delphine',
    },
  })

  await prisma.message.upsert({
    where: { publicId: 'seed-message-53028879-001' },
    update: {
      conversationId: conversation.id,
      reservationId: reservation.id,
      authorRole: MessageAuthorRole.HOST,
      userId: owner.id,
      body: 'Bonjour Clara, merci pour votre réservation.',
      state: MessageState.READ,
      sentAt: new Date('2026-03-06T09:30:00.000Z'),
    },
    create: {
      publicId: 'seed-message-53028879-001',
      conversationId: conversation.id,
      reservationId: reservation.id,
      authorRole: MessageAuthorRole.HOST,
      userId: owner.id,
      body: 'Bonjour Clara, merci pour votre réservation.',
      state: MessageState.READ,
      sentAt: new Date('2026-03-06T09:30:00.000Z'),
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
