/**
 * Canonical identity helpers for auth lookup and persistence.
 *
 * Email: trimmed + lowercased (RFC 5321 local-part case is preserved by some
 * providers, but Vaulty stores a single lowercase form to prevent duplicates).
 *
 * Phone: E.164 for Nigeria (`+234` + 10 national digits). Accepted inputs:
 * - Local: `08012345678`
 * - International: `2348012345678`, `+2348012345678`
 * - Spaced/dashed variants of the above
 */

const NIGERIA_COUNTRY_CODE = '234';
const NIGERIA_NATIONAL_LENGTH = 10;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Strips common formatting characters and returns digits only (leading + removed).
 */
function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Normalize a Nigerian phone number to E.164 (`+234XXXXXXXXXX`).
 * Returns `null` when the value cannot be interpreted as a valid NG mobile number.
 */
export function normalizePhoneNumber(phoneNumber: string): string | null {
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return null;
  }

  let digits = digitsOnly(trimmed);

  if (digits.startsWith(NIGERIA_COUNTRY_CODE) && digits.length === NIGERIA_COUNTRY_CODE.length + NIGERIA_NATIONAL_LENGTH) {
    // 234XXXXXXXXXX
  } else if (digits.startsWith('0') && digits.length === NIGERIA_NATIONAL_LENGTH + 1) {
    // 0XXXXXXXXXX → drop leading 0
    digits = NIGERIA_COUNTRY_CODE + digits.slice(1);
  } else if (digits.length === NIGERIA_NATIONAL_LENGTH) {
    // XXXXXXXXXX (national without trunk 0)
    digits = NIGERIA_COUNTRY_CODE + digits;
  } else {
    return null;
  }

  const national = digits.slice(NIGERIA_COUNTRY_CODE.length);
  // Nigerian mobile national numbers start with 7, 8, or 9
  if (!/^[789]\d{9}$/.test(national)) {
    return null;
  }

  return `+${digits}`;
}

export function assertNormalizedPhoneNumber(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    throw new Error('Invalid Nigerian phone number');
  }
  return normalized;
}
