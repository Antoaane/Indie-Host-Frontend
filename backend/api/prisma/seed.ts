import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.user.upsert({
    where: {
      externalUserId: 'user_demo_owner_001',
    },
    update: {
      displayName: 'Delphine',
      firstName: 'Delphine',
      lastName: 'Dupont',
      email: 'delphine.dupont@example.com',
      hostProfile: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
        avatar: 'https://a0.muscache.com/im/pictures/user/abb92beb-fd44-4562-9fff-45a19adddd23.jpg?im_w=720',
        'catalog-link': 'https://www.airbnb.fr/rooms/53028879#host-profile',
      },
      stripeConnectAccountId: 'acct_demo_owner_001',
      stripeConnectProfile: {
        accountId: 'acct_demo_owner_001',
        onboardingStatus: 'completed',
        chargesEnabled: true,
        payoutsEnabled: true,
        defaultCurrency: 'eur',
        transferSchedule: 'daily',
      },
    },
    create: {
      externalUserId: 'user_demo_owner_001',
      displayName: 'Delphine',
      firstName: 'Delphine',
      lastName: 'Dupont',
      email: 'delphine.dupont@example.com',
      hostProfile: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
        avatar: 'https://a0.muscache.com/im/pictures/user/abb92beb-fd44-4562-9fff-45a19adddd23.jpg?im_w=720',
        'catalog-link': 'https://www.airbnb.fr/rooms/53028879#host-profile',
      },
      stripeConnectAccountId: 'acct_demo_owner_001',
      stripeConnectProfile: {
        accountId: 'acct_demo_owner_001',
        onboardingStatus: 'completed',
        chargesEnabled: true,
        payoutsEnabled: true,
        defaultCurrency: 'eur',
        transferSchedule: 'daily',
      },
    },
  });

  await prisma.listing.upsert({
    where: {
      id: '53028879',
    },
    update: {
      ownerId: demoUser.id,
      status: 'published',
      core: {
        id: '53028879',
        status: 'published',
        title: 'Maison flottante / Houseboat ★ Baurechinsolite',
        type: 'Peniche',
        description: 'Logement insolite a 20km de Bordeaux.',
        guest_capacity: 3,
        city: 'Baurech',
        region: 'Nouvelle-Aquitaine',
        country: 'France',
      },
      bookings: {
        price: 174,
        fees: [
          { name: 'Frais de menage', amount: 35 },
        ],
        'booked-days': [
          { start: '2026-04-01', end: '2026-04-06' },
        ],
        reservations: [
          {
            id: 'reservation-53028879-001',
            start: '2026-04-01',
            end: '2026-04-06',
            nights: 5,
            guestName: 'Thomas Nguyen',
            message: 'Sejour calme prevu.',
            guests: {
              adults: 2,
              children: 0,
              infants: 0,
              pets: 0,
              pmr: 0,
            },
            payment: {
              total: 905,
              deposit: 905,
              balance: 0,
              status: 'paid',
              method: 'SEPA',
            },
            contact: {
              firstName: 'Thomas',
              lastName: 'Nguyen',
              email: 'thomas.nguyen@example.com',
              phone: '+33600000000',
            },
            createdAt: '2026-03-05T09:30:00Z',
          },
        ],
      },
      medias: {
        images: [
          { src: '/assets/media/images/listing-test-0/image0.jpg', alt: 'Maison flottante', position: 0 },
        ],
        videos: [],
      },
      arrival: {
        intro: {
          title: 'Bienvenue',
          subtitle: 'Pour profiter des lieux au maximum, voici votre guide d\'arrivee.',
          tagline: 'Propulse par IndieHost',
        },
        practical: {
          savings: { message: 'Reservez en direct pour eviter les commissions.' },
          access: {
            address: 'Baurech, Nouvelle-Aquitaine',
            checkIn: 'A partir de 16h',
            checkOut: 'Avant 11h',
            parking: 'Gratuit sur place',
          },
          services: {
            wifi: 'Disponible',
            contacts: 'Urgences 112',
            assistance: 'Assistance hote 9h-21h',
          },
          rules: '',
          shops: '',
        },
        guide: {
          title: 'Decouvertes locales',
          content: '<p>Guide local.</p>',
        },
      },
      notes: {
        note: {
          note: 4.68,
          distribution: { '1': 0, '2': 0, '3': 1, '4': 21, '5': 28 },
        },
      },
      comments: {
        comments: [],
      },
      host: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
        avatar: 'https://a0.muscache.com/im/pictures/user/abb92beb-fd44-4562-9fff-45a19adddd23.jpg?im_w=720',
        'catalog-link': 'https://www.airbnb.fr/rooms/53028879#host-profile',
      },
    },
    create: {
      id: '53028879',
      ownerId: demoUser.id,
      status: 'published',
      core: {
        id: '53028879',
        status: 'published',
        title: 'Maison flottante / Houseboat ★ Baurechinsolite',
        type: 'Peniche',
        description: 'Logement insolite a 20km de Bordeaux.',
        guest_capacity: 3,
        city: 'Baurech',
        region: 'Nouvelle-Aquitaine',
        country: 'France',
      },
      bookings: {
        price: 174,
        fees: [
          { name: 'Frais de menage', amount: 35 },
        ],
        'booked-days': [
          { start: '2026-04-01', end: '2026-04-06' },
        ],
        reservations: [
          {
            id: 'reservation-53028879-001',
            start: '2026-04-01',
            end: '2026-04-06',
            nights: 5,
            guestName: 'Thomas Nguyen',
            message: 'Sejour calme prevu.',
            guests: {
              adults: 2,
              children: 0,
              infants: 0,
              pets: 0,
              pmr: 0,
            },
            payment: {
              total: 905,
              deposit: 905,
              balance: 0,
              status: 'paid',
              method: 'SEPA',
            },
            contact: {
              firstName: 'Thomas',
              lastName: 'Nguyen',
              email: 'thomas.nguyen@example.com',
              phone: '+33600000000',
            },
            createdAt: '2026-03-05T09:30:00Z',
          },
        ],
      },
      medias: {
        images: [
          { src: '/assets/media/images/listing-test-0/image0.jpg', alt: 'Maison flottante', position: 0 },
        ],
        videos: [],
      },
      arrival: {
        intro: {
          title: 'Bienvenue',
          subtitle: 'Pour profiter des lieux au maximum, voici votre guide d\'arrivee.',
          tagline: 'Propulse par IndieHost',
        },
        practical: {
          savings: { message: 'Reservez en direct pour eviter les commissions.' },
          access: {
            address: 'Baurech, Nouvelle-Aquitaine',
            checkIn: 'A partir de 16h',
            checkOut: 'Avant 11h',
            parking: 'Gratuit sur place',
          },
          services: {
            wifi: 'Disponible',
            contacts: 'Urgences 112',
            assistance: 'Assistance hote 9h-21h',
          },
          rules: '',
          shops: '',
        },
        guide: {
          title: 'Decouvertes locales',
          content: '<p>Guide local.</p>',
        },
      },
      notes: {
        note: {
          note: 4.68,
          distribution: { '1': 0, '2': 0, '3': 1, '4': 21, '5': 28 },
        },
      },
      comments: {
        comments: [],
      },
      host: {
        name: 'Delphine',
        status: 'SuperHost',
        seniority: 48,
        'global-note': 4.95,
        avatar: 'https://a0.muscache.com/im/pictures/user/abb92beb-fd44-4562-9fff-45a19adddd23.jpg?im_w=720',
        'catalog-link': 'https://www.airbnb.fr/rooms/53028879#host-profile',
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
