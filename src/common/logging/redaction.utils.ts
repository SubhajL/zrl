const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

const SENSITIVE_KEYS = new Set([
  'address',
  'company',
  'companyname',
  'contact',
  'contactemail',
  'contactname',
  'email',
  'fullname',
  'lineuserid',
  'name',
  'phone',
  'phonenumber',
  'signername',
  'taxid',
  'taxnumber',
]);

export const REDACTED_VALUE = '[REDACTED]';
export const REDACTED_EMAIL = '[REDACTED_EMAIL]';
export const REDACTED_PHONE = '[REDACTED_PHONE]';

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

export function redactLogMessage(message: string): string {
  return message
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(PHONE_PATTERN, REDACTED_PHONE);
}

export function redactLogValue(value: unknown, key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }

  if (typeof value === 'string') {
    return redactLogMessage(value);
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} bytes]`;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}
