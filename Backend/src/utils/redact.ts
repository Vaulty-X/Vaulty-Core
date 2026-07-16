const secretValues = new Set<string>();

/**
 * Registers a value (JWT secret, password, etc.) so `redact` can strip it
 * out of any log line or error message before it reaches stdout/stderr.
 */
export const registerSecret = (secret: string | undefined | null): void => {
  if (secret && secret.length >= 4) {
    secretValues.add(secret);
  }
};

const maskConnectionStringCredentials = (input: string): string =>
  input.replace(/(:\/\/[^:/\s@]+:)([^@\s]+)(@)/g, '$1***REDACTED***$3');

export const redact = (input: string): string => {
  let output = input;
  for (const secret of secretValues) {
    output = output.split(secret).join('***REDACTED***');
  }
  return maskConnectionStringCredentials(output);
};

export const redactError = (err: unknown): string => {
  if (err instanceof Error) {
    const parts = [err.name, err.message].filter(Boolean);
    if (err.stack) {
      parts.push(err.stack);
    }
    return redact(parts.join(': '));
  }

  if (typeof err === 'string') {
    return redact(err);
  }

  try {
    return redact(JSON.stringify(err));
  } catch {
    return redact(String(err));
  }
};
