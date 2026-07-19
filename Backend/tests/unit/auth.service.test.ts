import { AppError } from '../../src/utils/AppError';
import { hashToken } from '../../src/utils/crypto';
import { generateRefreshToken } from '../../src/utils/jwt';
import { queuePasswordResetEmail, queueVerificationEmail } from '../../src/queues';
import { userRepository } from '../../src/repositories/user.repository';
import { authService } from '../../src/services/auth.service';

jest.mock('../../src/repositories/user.repository', () => ({
  userRepository: {
    findByEmail: jest.fn(),
    findByPhoneNumber: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    incrementTokenVersion: jest.fn(),
    createEmailVerificationToken: jest.fn(),
    consumeEmailVerificationToken: jest.fn(),
    invalidateUnusedEmailVerificationTokens: jest.fn(),
    createPasswordResetToken: jest.fn(),
    consumePasswordResetToken: jest.fn(),
    createRefreshSession: jest.fn(),
    findRefreshSessionByTokenHash: jest.fn(),
    revokeRefreshSession: jest.fn(),
    revokeRefreshSessionFamily: jest.fn(),
    revokeAllUserRefreshSessions: jest.fn(),
    revokeRefreshSessionById: jest.fn(),
    expireInactiveRefreshSessions: jest.fn(),
  },
}));

jest.mock('../../src/queues', () => ({
  queuePasswordResetEmail: jest.fn(),
  queueVerificationEmail: jest.fn(),
}));

const mockUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mockQueueVerificationEmail = queueVerificationEmail as jest.Mock;
const mockQueuePasswordResetEmail = queuePasswordResetEmail as jest.Mock;

const user = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: null as string | null,
  isEmailVerified: false,
  role: 'USER',
  createdAt: new Date(),
};

describe('AuthService token secrecy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueVerificationEmail.mockResolvedValue({ id: 'email-job-1' });
    mockQueuePasswordResetEmail.mockResolvedValue({ id: 'email-job-2' });
  });

  it('does not return a raw verification token during registration and stores only a hash', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue(user as never);
    mockUserRepository.createEmailVerificationToken.mockResolvedValue({} as never);

    const result = await authService.register({
      email: user.email,
      password: 'Password1',
      firstName: user.firstName,
      lastName: user.lastName,
    });

    expect(result).toEqual({ user });
    expect(result).not.toHaveProperty('verificationToken');

    const queued = mockQueueVerificationEmail.mock.calls.at(0)?.[0] as { token: string };
    const storedHash = mockUserRepository.createEmailVerificationToken.mock.calls.at(0)?.[1] as string;

    expect(queued.token).toBeTruthy();
    expect(storedHash).toBe(hashToken(queued.token));
    expect(storedHash).not.toBe(queued.token);
  });

  it('queues password reset delivery without returning or storing the raw token', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({ ...user, passwordHash: 'hash' } as never);
    mockUserRepository.createPasswordResetToken.mockResolvedValue({} as never);

    const result = await authService.forgotPassword({ email: user.email });

    expect(result).toEqual({ message: 'If the email exists, a reset link has been sent' });

    const queued = mockQueuePasswordResetEmail.mock.calls.at(0)?.[0] as { token: string };
    const storedHash = mockUserRepository.createPasswordResetToken.mock.calls.at(0)?.[1] as string;

    expect(queued.token).toBeTruthy();
    expect(storedHash).toBe(hashToken(queued.token));
    expect(storedHash).not.toBe(queued.token);
  });

  it('rejects expired password reset tokens', async () => {
    mockUserRepository.consumePasswordResetToken.mockResolvedValue(null);

    await expect(authService.resetPassword({ token: 'expired-token', password: 'Password2' })).rejects.toThrow(
      new AppError('Invalid or expired reset token', 400)
    );

    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('rejects already-used email verification tokens', async () => {
    mockUserRepository.consumeEmailVerificationToken.mockResolvedValue(null);

    await expect(authService.verifyEmail({ token: 'used-token' })).rejects.toThrow(
      new AppError('Invalid or expired verification token', 400)
    );

    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('resends verification by invalidating older unused tokens and queuing a new hashed token', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({ ...user, passwordHash: 'hash' } as never);
    mockUserRepository.invalidateUnusedEmailVerificationTokens.mockResolvedValue({ count: 1 } as never);
    mockUserRepository.createEmailVerificationToken.mockResolvedValue({} as never);

    const result = await authService.resendVerificationEmail({ email: user.email });

    expect(result).toEqual({
      message: 'If the email exists and is unverified, a verification link has been sent',
    });
    expect(mockUserRepository.invalidateUnusedEmailVerificationTokens).toHaveBeenCalledWith(user.id);

    const queued = mockQueueVerificationEmail.mock.calls.at(0)?.[0] as { token: string };
    const storedHash = mockUserRepository.createEmailVerificationToken.mock.calls.at(0)?.[1] as string;

    expect(storedHash).toBe(hashToken(queued.token));
    expect(storedHash).not.toBe(queued.token);
  });

  it('rejects logout attempts for sessions that do not belong to the authenticated user', async () => {
    const rawRefreshToken = generateRefreshToken({
      userId: 'user-1',
      email: user.email,
      role: 'USER',
      jti: 'session-1',
    });

    mockUserRepository.findRefreshSessionByTokenHash.mockResolvedValue({
      id: 'session-1',
      userId: 'other-user',
      revokedAt: null,
    } as never);

    await expect((authService as any).logout('user-1', rawRefreshToken)).rejects.toThrow(
      new AppError('Session not found', 404)
    );

    expect(mockUserRepository.revokeRefreshSession).not.toHaveBeenCalled();
  });
});

describe('AuthService identity canonicalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueVerificationEmail.mockResolvedValue({ id: 'email-job-1' });
  });

  it('normalizes email case/whitespace and phone format before duplicate checks and create', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.findByPhoneNumber.mockResolvedValue(null);
    mockUserRepository.create.mockResolvedValue({
      ...user,
      email: 'user@example.com',
      phoneNumber: '+2348012345678',
    } as never);
    mockUserRepository.createEmailVerificationToken.mockResolvedValue({} as never);

    await authService.register({
      email: '  User@Example.COM ',
      password: 'SecurePass123',
      phoneNumber: '08012345678',
    });

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mockUserRepository.findByPhoneNumber).toHaveBeenCalledWith('+2348012345678');
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        phoneNumber: '+2348012345678',
      })
    );
  });

  it('rejects duplicate registration when email differs only by case', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({ ...user, email: 'user@example.com' } as never);

    await expect(
      authService.register({
        email: 'USER@EXAMPLE.COM',
        password: 'SecurePass123',
      })
    ).rejects.toThrow(new AppError('User with this email already exists', 409));

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mockUserRepository.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate registration when phone differs only by Nigerian format', async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockUserRepository.findByPhoneNumber.mockResolvedValue({
      ...user,
      phoneNumber: '+2348012345678',
    } as never);

    await expect(
      authService.register({
        email: 'other@example.com',
        password: 'SecurePass123',
        phoneNumber: '08012345678',
      })
    ).rejects.toThrow(new AppError('User with this phone number already exists', 409));

    expect(mockUserRepository.findByPhoneNumber).toHaveBeenCalledWith('+2348012345678');
    expect(mockUserRepository.create).not.toHaveBeenCalled();
  });

  it('logs in successfully when email case/whitespace differs from stored value', async () => {
    mockUserRepository.findByEmail.mockResolvedValue({
      ...user,
      email: 'user@example.com',
      tokenVersion: 0,
      passwordHash: await import('../../src/utils/crypto').then((m) => m.hashPassword('SecurePass123')),
    } as never);
    mockUserRepository.update.mockResolvedValue(user as never);
    mockUserRepository.createRefreshSession.mockResolvedValue({} as never);

    const result = await authService.login({
      email: '  USER@EXAMPLE.COM ',
      password: 'SecurePass123',
    });

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe('user@example.com');
  });
});
