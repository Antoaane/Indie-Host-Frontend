import fp from 'fastify-plugin';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { rateLimitByIp } from '../../lib/rateLimit.js';

// Bornes sur la taille du prompt : la route reste publique (assistant de création sans compte).
const roomBedSchema = z.object({
  type: z.string().max(40).optional(),
  quantity: z.coerce.number().optional(),
  capacity: z.coerce.number().optional(),
});

const roomSchema = z.object({
  'room-name': z.string().max(120).optional(),
  name: z.string().max(120).optional(),
  beds: z.array(roomBedSchema).max(20).optional(),
});

const amenitySchema = z.object({
  name: z.string().max(120),
  relevance: z.coerce.number().optional(),
  pinned: z.boolean().optional(),
});

const generateDescriptionBodySchema = z.object({
  title: z.string().max(200).optional(),
  type: z.string().max(40).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  guest_capacity: z.coerce.number().optional(),
  rooms: z.array(roomSchema).max(30).optional(),
  amenities: z.array(amenitySchema).max(200).optional(),
  length_level: z.coerce.number().min(1).max(3).optional().default(2),
});

type GenerateDescriptionBody = z.infer<typeof generateDescriptionBodySchema>;

const LISTING_TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  gite: 'Gîte',
  villa: 'Villa',
  studio: 'Studio',
  chalet: 'Chalet',
  loft: 'Loft',
  cottage: 'Cottage',
  cabin: 'Cabane',
  room: 'Chambre',
  other: 'Logement',
};

const BED_TYPE_LABELS: Record<string, string> = {
  double: 'lit double',
  queen: 'lit queen size',
  king: 'lit king size',
  single: 'lit simple',
  bunk: 'lits superposés',
  sofa: 'canapé-lit',
  crib: 'lit bébé',
};

function buildPrompt(body: GenerateDescriptionBody): string {
  const type = (body.type && LISTING_TYPE_LABELS[body.type]) ?? 'Logement';
  const title = body.title?.trim();
  const location = [body.city, body.region, body.country].filter(Boolean).join(', ');
  const capacity = body.guest_capacity;

  const roomLines = (body.rooms ?? [])
    .map((room) => {
      const roomName = (room['room-name'] ?? room.name ?? 'Pièce').trim();
      const beds = (room.beds ?? [])
        .filter((b) => b.quantity && b.quantity > 0)
        .map((b) => {
          const label = (b.type && BED_TYPE_LABELS[b.type]) ?? b.type ?? 'lit';
          return `${b.quantity} ${label}`;
        })
        .join(', ');
      return beds ? `  - ${roomName} : ${beds}` : `  - ${roomName}`;
    })
    .filter(Boolean)
    .join('\n');

  // Équipements à valeur : pinned ou relevance >= 3, max 18
  const amenities = (body.amenities ?? [])
    .filter((a) => a.pinned === true || (a.relevance != null && a.relevance >= 3))
    .slice(0, 18)
    .map((a) => a.name)
    .join(', ');

  const lines = [
    `Type : ${type}`,
    title ? `Titre : ${title}` : null,
    location ? `Localisation : ${location}` : null,
    capacity ? `Capacité : ${capacity} voyageur${capacity > 1 ? 's' : ''}` : null,
    roomLines ? `Agencement :\n${roomLines}` : null,
    amenities ? `Équipements clés : ${amenities}` : null,
  ].filter(Boolean).join('\n');

  const lengthHint = ['courte (1 à 2 sections)', 'moyenne (2 à 3 sections)', 'complète (3 à 4 sections)'][body.length_level - 1];

  return [
    `Génère une description ${lengthHint} de logement pour Airbnb/Booking en français à partir de ces informations :`,
    '',
    lines,
    '',
    'Règles :',
    '- Uniquement du HTML avec les balises <h2>, <p>, <strong>, <em>',
    '- Aucune autre balise HTML (pas de div, ul, li, html, body, head)',
    '- Structure : 1 paragraphe <p> d\'accroche, puis 2 ou 3 sections <h2> + <p>, puis 1 courte phrase de conclusion <p>',
    '- Phrases courtes et directes, vocabulaire simple, ton accueillant',
    '- Commence directement par le HTML, sans introduction ni commentaire',
  ].join('\n');
}

const MAX_TOKENS_BY_LEVEL = [500, 900, 1400];
const MAX_CHARS_BY_LEVEL = [1000, 2000, 3000];

function truncateToCharLimit(html: string, maxChars: number): string {
  const plain = html.replace(/<[^>]+>/g, '');
  if (plain.length <= maxChars) return html;

  const segments = html.match(/<(?:p|h2)[^>]*>[\s\S]*?<\/(?:p|h2)>/g) ?? [];
  let result = '';
  let count = 0;

  for (const seg of segments) {
    const segText = seg.replace(/<[^>]+>/g, '');
    if (count + segText.length > maxChars) break;
    result += seg;
    count += segText.length;
  }

  return result || html;
}

async function callGroq(prompt: string, apiKey: string, lengthLevel: number): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Tu es un expert en rédaction de descriptions de logements de vacances pour Airbnb et Booking.com. Tu génères uniquement du HTML propre avec les balises <h2>, <p>, <strong>, <em>. Aucune autre balise HTML, aucun markdown, aucun commentaire. Tu respectes toujours strictement la contrainte de longueur indiquée dans le message utilisateur.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.75,
      max_tokens: MAX_TOKENS_BY_LEVEL[lengthLevel - 1] ?? 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() ?? '';
}

export const aiPlugin = fp(async (fastify) => {
  fastify.post('/ai/description', {
    preHandler: [
      rateLimitByIp({
        max: 20,
        windowMs: 10 * 60 * 1000,
        message: 'Trop de générations à la suite. Réessayez dans quelques minutes.',
      }),
      fastify.authenticateOptional,
    ],
  }, async (request, reply) => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      reply.code(503).send({ message: 'La génération IA n\'est pas configurée (GROQ_API_KEY manquant).' });
      return;
    }

    const body = generateDescriptionBodySchema.parse(request.body);
    const prompt = buildPrompt(body);
    const rawHtml = await callGroq(prompt, apiKey, body.length_level);
    const maxChars = MAX_CHARS_BY_LEVEL[body.length_level - 1] ?? 2000;
    const truncated = truncateToCharLimit(rawHtml, maxChars);
    const html = truncated.replace(/(.+?)<h2>/gs, '$1<p><br></p><h2>');

    reply.send({ html });
  });
});
