import { prisma } from '../../src/database';
import { createApp } from '../../src/app';
import { hashToken, generateSecureToken } from '../../src/utils/crypto';
import request from 'supertest';

const app = createApp();

async function createUser(email: string) {
  const { hashPassword } = await import('../../src/utils/crypto');
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword('Password1'),
    },
  });
}

describe('Token atomic consumption', () => {
  afterEach(async () => {
    await prisma.emailVerificationToken.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it('only one of two concurrent reset requests succeeds', async () => {
    const user = await createUser('reset-test@example.com');
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const results = await Promise.all([
      request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, password: 'NewPassword1' }),
      request(app).post('/api/v1/auth/reset-password').send({ token: rawToken, password: 'NewPassword1' }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);

    const tokenAfter = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    expect(tokenAfter?.used).toBe(true);
  });

  it('only one of two concurrent verify-email requests succeeds', async () => {
    const user = await createUser('verify-test@example.com');
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const results = await Promise.all([
      request(app).post('/api/v1/auth/verify-email').send({ token: rawToken }),
      request(app).post('/api/v1/auth/verify-email').send({ token: rawToken }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);

    const tokenAfter = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    expect(tokenAfter?.used).toBe(true);
  });

  it('returns consistent error for expired, used, and unknown tokens', async () => {
    const user = await createUser('consistent-test@example.com');

    const expiredRaw = generateSecureToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(expiredRaw),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const usedRaw = generateSecureToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(usedRaw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        used: true,
      },
    });

    const unknownRaw = generateSecureToken();

    const [expired, used, unknown] = await Promise.all([
      request(app).post('/api/v1/auth/reset-password').send({ token: expiredRaw, password: 'NewPassword1' }),
      request(app).post('/api/v1/auth/reset-password').send({ token: usedRaw, password: 'NewPassword1' }),
      request(app).post('/api/v1/auth/reset-password').send({ token: unknownRaw, password: 'NewPassword1' }),
    ]);

    expect(expired.status).toBe(400);
    expect(used.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(expired.body.message).toBe(used.body.message);
    expect(used.body.message).toBe(unknown.body.message);
  });

  it('revokes refresh tokens after password reset', async () => {
    const user = await createUser('revoke-test@example.com');
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'revoke-test@example.com', password: 'Password1' });
    const oldRefreshToken = loginRes.body.data.refreshToken;

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, password: 'NewPassword1' });

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshRes.status).toBe(401);

    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'revoke-test@example.com', password: 'NewPassword1' });
    expect(loginNew.status).toBe(200);
  });
});
