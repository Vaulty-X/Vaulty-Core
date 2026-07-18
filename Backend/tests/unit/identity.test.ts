import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../../src/utils/identity';

describe('identity normalization', () => {
  describe('normalizeEmail', () => {
    it('trims whitespace and lowercases', () => {
      expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });
  });

  describe('normalizePhoneNumber', () => {
    it('canonicalizes Nigerian local and international formats to E.164', () => {
      expect(normalizePhoneNumber('08012345678')).toBe('+2348012345678');
      expect(normalizePhoneNumber('+2348012345678')).toBe('+2348012345678');
      expect(normalizePhoneNumber('2348012345678')).toBe('+2348012345678');
      expect(normalizePhoneNumber('080 1234 5678')).toBe('+2348012345678');
      expect(normalizePhoneNumber('+234-801-234-5678')).toBe('+2348012345678');
    });

    it('rejects invalid phone values', () => {
      expect(normalizePhoneNumber('12345')).toBeNull();
      expect(normalizePhoneNumber('+15551234567')).toBeNull();
      expect(normalizePhoneNumber('')).toBeNull();
    });
  });
});
