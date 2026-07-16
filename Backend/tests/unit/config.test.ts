const ORIGINAL_ENV = process.env;

const baseEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@db.internal:5432/vaulty',
  REDIS_HOST: 'redis.internal',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'a-real-redis-password',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGIN: 'https://app.vaulty.example',
  STELLAR_NETWORK: 'mainnet',
  STELLAR_HORIZON_URL: 'https://horizon.stellar.org',
};

describe('config validation', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...baseEnv };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('loads successfully in production when all required values are valid', () => {
    const { config } = require('../../src/config');

    expect(config.isProduction).toBe(true);
    expect(config.jwt.accessTokenSecret).toBe(baseEnv.JWT_ACCESS_SECRET);
    expect(config.cors.origin).toEqual(['https://app.vaulty.example']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('fails startup in production when JWT secrets are missing', () => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_ACCESS_SECRET'));
  });

  it('fails startup in production when JWT secret is a known insecure placeholder', () => {
    process.env.JWT_ACCESS_SECRET = 'your-super-secret-access-key-change-in-production';

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('insecure placeholder'));
  });

  it('fails startup in production when DATABASE_URL is left at the local default', () => {
    delete process.env.DATABASE_URL;

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
  });

  it('fails startup in production when REDIS_PASSWORD is absent', () => {
    delete process.env.REDIS_PASSWORD;

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_PASSWORD'));
  });

  it('fails startup in production when CORS_ORIGIN is "*"', () => {
    process.env.CORS_ORIGIN = '*';

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('CORS_ORIGIN must not be "*"'));
  });

  it('fails startup when PORT is out of range, in any environment', () => {
    process.env.PORT = '99999';

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('PORT must be an integer'));
  });

  it('fails startup when STELLAR_NETWORK is not testnet or mainnet', () => {
    process.env.STELLAR_NETWORK = 'devnet';

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('STELLAR_NETWORK'));
  });

  it('fails startup when mainnet is paired with a testnet Horizon URL', () => {
    process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';

    require('../../src/config');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('testnet endpoint'));
  });

  it('falls back to development defaults silently when values are simply absent', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PASSWORD;
    delete process.env.CORS_ORIGIN;
    delete process.env.STELLAR_NETWORK;
    delete process.env.STELLAR_HORIZON_URL;

    const { config } = require('../../src/config');

    expect(exitSpy).not.toHaveBeenCalled();
    expect(config.database.url).toBe('postgresql://localhost:5432/vaulty');
    expect(config.stellar.network).toBe('testnet');
  });

  it('warns (but does not exit) on structurally invalid values outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = 'not-a-port';

    const { config } = require('../../src/config');

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PORT must be an integer'));
    expect(config.port).toBe(3000);
  });

  it('redacts JWT secrets from subsequent logged error output', () => {
    const { config } = require('../../src/config');
    const { redact } = require('../../src/utils/redact');

    const message = `token signed with ${config.jwt.accessTokenSecret} failed`;
    expect(redact(message)).not.toContain(config.jwt.accessTokenSecret);
    expect(redact(message)).toContain('***REDACTED***');
  });
});
