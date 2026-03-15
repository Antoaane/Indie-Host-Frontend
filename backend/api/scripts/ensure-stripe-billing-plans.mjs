import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');
const envPath = path.join(apiRoot, '.env');

dotenv.config({ path: envPath });

const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY ?? '').trim();
if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY in backend/api/.env');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
});

const plans = [
  {
    code: 'indiehost',
    name: 'IndieHost',
    description: 'Plan de base IndieHost',
    monthlyPriceMinor: 1600,
    maxActiveListings: 2,
  },
  {
    code: 'superhost',
    name: 'SuperHost',
    description: 'Plan avancé SuperHost',
    monthlyPriceMinor: 3900,
    maxActiveListings: 5,
  },
  {
    code: 'megahost',
    name: 'MegaHost',
    description: 'Plan professionnel MegaHost',
    monthlyPriceMinor: 9900,
    maxActiveListings: 15,
  },
];

function isExpectedMonthlyPrice(price, expectedAmount) {
  return Boolean(
    price.active
      && price.type === 'recurring'
      && price.currency === 'eur'
      && price.unit_amount === expectedAmount
      && price.recurring?.interval === 'month'
      && (price.recurring?.interval_count ?? 1) === 1,
  );
}

async function findOrCreateProduct(plan) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  for (const product of products.data) {
    if (product.metadata?.indiehost_plan_code === plan.code) return product;
  }

  for (const product of products.data) {
    if (product.name.trim().toLowerCase() === plan.name.trim().toLowerCase()) return product;
  }

  return stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      indiehost_plan_code: plan.code,
      indiehost_max_active_listings: String(plan.maxActiveListings),
      indiehost_source: 'dev-bootstrap',
    },
  });
}

async function findOrCreatePrice(productId, plan) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  for (const price of prices.data) {
    if (isExpectedMonthlyPrice(price, plan.monthlyPriceMinor)) return price;
  }

  return stripe.prices.create({
    product: productId,
    currency: 'eur',
    unit_amount: plan.monthlyPriceMinor,
    recurring: {
      interval: 'month',
    },
    metadata: {
      indiehost_plan_code: plan.code,
      indiehost_source: 'dev-bootstrap',
    },
  });
}

async function run() {
  for (const plan of plans) {
    const product = await findOrCreateProduct(plan);
    const price = await findOrCreatePrice(product.id, plan);
    console.log(`${plan.code}: product=${product.id} price=${price.id}`);
  }
  console.log('Stripe billing plans are ready. The API now resolves products/prices directly from Stripe.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
