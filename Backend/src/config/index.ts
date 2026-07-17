import dotenv from 'dotenv';
import { registerSecret } from '../utils/redact';

dotenv.config({ quiet: true });

type NodeEnv = 'development' | 'test' | 'production';
type StellarNetwork = 'testnet' | 'mainnet';

const VALID_NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];
const VALID_STELLAR_NETWORKS: StellarNetwork[] = ['testnet', 'mainnet'];

// Known placeholder values that must never be used in production. Anyone who
// copies .env.example verbatim ends up with one of these.
const INSECURE_JWT_SECRETS = new Set([
  'access-secret-key',
  'refresh-secret-key',
  'your-super-secret-access-key-change-in-production',
  'your-super-secret-refresh-key-change-in-production',
]);

const DEV_FALLBACKS = {
  databaseUrl: 'postgresql://localhost:5432/vaulty',
  redisHost: 'localhost',
  jwtAccessSecret: 'dev-only-access-secret-not-for-production-use',
  jwtRefreshSecret: 'dev-only-refresh-secret-not-for-production-use',
  corsOrigin: 'http://localhost:3000',
  stellarNetwork: 'testnet' as StellarNetwork,
  stellarHorizonUrl: 'https://horizon-testnet.stellar.org',
};

const problems: string[] = [];

const rawNodeEnv = process.env.NODE_ENV || 'development';
if (!VALID_NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
  problems.push(
    `NODE_ENV must be one of ${VALID_NODE_ENVS.join(', ')}, received "${rawNodeEnv}".`
  );
}
const nodeEnv: NodeEnv = VALID_NODE_ENVS.includes(rawNodeEnv as NodeEnv)
  ? (rawNodeEnv as NodeEnv)
  : 'development';
const isProduction = nodeEnv === 'production';

/** Records a problem when a value that must be explicit in production is missing. */
function requireInProduction(value: string | undefined, name: string): void {
  if (isProduction && !value) {
    problems.push(`${name} is required in production and must not be left unset.`);
  }
}

function isValidUrl(value: string, allowedProtocols: string[]): boolean {
  try {
    const parsed = new URL(value);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function parsePort(raw: string | undefined, name: string, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    problems.push(`${name} must be an integer between 1 and 65535, received "${raw}".`);
    return fallback;
  }
  return parsed;
}

// --- PORT ---
const port = parsePort(process.env.PORT, 'PORT', 3000);

// --- DATABASE ---
requireInProduction(process.env.DATABASE_URL, 'DATABASE_URL');
const databaseUrl = process.env.DATABASE_URL || DEV_FALLBACKS.databaseUrl;
if (isProduction && databaseUrl === DEV_FALLBACKS.databaseUrl) {
  problems.push('DATABASE_URL must not use the default local development value in production.');
}
if (!isValidUrl(databaseUrl, ['postgres:', 'postgresql:'])) {
  problems.push('DATABASE_URL must be a valid postgres:// or postgresql:// connection string.');
}

// --- REDIS ---
requireInProduction(process.env.REDIS_HOST, 'REDIS_HOST');
const redisHost = process.env.REDIS_HOST || DEV_FALLBACKS.redisHost;
if (isProduction && redisHost === DEV_FALLBACKS.redisHost) {
  problems.push('REDIS_HOST must not use the default local development value in production.');
}
const redisPort = parsePort(process.env.REDIS_PORT, 'REDIS_PORT', 6379);
const redisPassword = process.env.REDIS_PASSWORD;
if (isProduction && !redisPassword) {
  problems.push('REDIS_PASSWORD is required in production to prevent unauthenticated Redis access.');
}

// --- JWT ---
requireInProduction(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
requireInProduction(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || DEV_FALLBACKS.jwtAccessSecret;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || DEV_FALLBACKS.jwtRefreshSecret;

if (INSECURE_JWT_SECRETS.has(jwtAccessSecret)) {
  problems.push('JWT_ACCESS_SECRET is set to a known insecure placeholder value. Generate a new secret.');
}
if (INSECURE_JWT_SECRETS.has(jwtRefreshSecret)) {
  problems.push('JWT_REFRESH_SECRET is set to a known insecure placeholder value. Generate a new secret.');
}
if (isProduction) {
  if (jwtAccessSecret.length < 32) {
    problems.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
  }
  if (jwtRefreshSecret.length < 32) {
    problems.push('JWT_REFRESH_SECRET must be at least 32 characters in production.');
  }
  if (jwtAccessSecret === jwtRefreshSecret) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be the same value.');
  }
}

// --- CORS ---
requireInProduction(process.env.CORS_ORIGIN, 'CORS_ORIGIN');
const corsOriginRaw = process.env.CORS_ORIGIN || DEV_FALLBACKS.corsOrigin;
if (isProduction && corsOriginRaw === DEV_FALLBACKS.corsOrigin) {
  problems.push('CORS_ORIGIN must not use the default local development value in production.');
}
const corsOrigins = corsOriginRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) {
  problems.push('CORS_ORIGIN must contain at least one origin.');
}
for (const origin of corsOrigins) {
  if (origin === '*') {
    if (isProduction) {
      problems.push('CORS_ORIGIN must not be "*" in production.');
    }
    continue;
  }
  if (!isValidUrl(origin, ['http:', 'https:'])) {
    problems.push(`CORS_ORIGIN entry "${origin}" must be a valid http:// or https:// URL.`);
  }
}

// --- STELLAR ---
requireInProduction(process.env.STELLAR_NETWORK, 'STELLAR_NETWORK');
const rawStellarNetwork = process.env.STELLAR_NETWORK || DEV_FALLBACKS.stellarNetwork;
if (!VALID_STELLAR_NETWORKS.includes(rawStellarNetwork as StellarNetwork)) {
  problems.push(
    `STELLAR_NETWORK must be one of ${VALID_STELLAR_NETWORKS.join(', ')}, received "${rawStellarNetwork}".`
  );
}
const stellarNetwork: StellarNetwork = VALID_STELLAR_NETWORKS.includes(
  rawStellarNetwork as StellarNetwork
)
  ? (rawStellarNetwork as StellarNetwork)
  : DEV_FALLBACKS.stellarNetwork;

requireInProduction(process.env.STELLAR_HORIZON_URL, 'STELLAR_HORIZON_URL');
const stellarHorizonUrl = process.env.STELLAR_HORIZON_URL || DEV_FALLBACKS.stellarHorizonUrl;
if (!isValidUrl(stellarHorizonUrl, ['http:', 'https:'])) {
  problems.push('STELLAR_HORIZON_URL must be a valid http:// or https:// URL.');
}
if (isProduction && stellarNetwork === 'mainnet' && stellarHorizonUrl.includes('testnet')) {
  problems.push(
    'STELLAR_HORIZON_URL points to a testnet endpoint while STELLAR_NETWORK is "mainnet".'
  );
}

// --- Report and enforce ---
if (problems.length > 0) {
  const heading = isProduction
    ? 'Refusing to start: invalid production configuration detected:'
    : 'Configuration warnings (falling back to development defaults):';
  const message = [heading, ...problems.map((problem) => `  - ${problem}`)].join('\n');

  if (isProduction) {
    // eslint-disable-next-line no-console
    console.error(message);
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
}

// Register anything sensitive so it gets stripped from logs/error output.
registerSecret(jwtAccessSecret);
registerSecret(jwtRefreshSecret);
registerSecret(redisPassword);
try {
  registerSecret(new URL(databaseUrl).password);
} catch {
  // Already reported above as an invalid DATABASE_URL.
}

export const config = {
  port,
  nodeEnv,
  isProduction,

  database: {
    url: databaseUrl,
  },

  redis: {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
  },

  jwt: {
    accessTokenSecret: jwtAccessSecret,
    refreshTokenSecret: jwtRefreshSecret,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },


  cors: {
    origin: corsOrigins,
  },

  stellar: {
    network: stellarNetwork,
    horizonUrl: stellarHorizonUrl,
  },
};

/**
 * Parses the configured refresh-token expiry into milliseconds so the
 * persisted session record can store an absolute expiry timestamp. Supports
 * the same unit suffixes used by jsonwebtoken (s, m, h, d). If parsing fails
 * the default of 7 days is used.
 */
export const parseRefreshTokenExpiryMs = (): number => {
  const raw = config.jwt.refreshTokenExpiry;
  const match = /^(\d+)\s*([smhd])$/.exec(raw.trim());
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return value * unitMs[match[2] as 's' | 'm' | 'h' | 'd'];
};
