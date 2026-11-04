export function sanitizeField(value: string): string {
  return value.trim();
}

export function parseFields(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = sanitizeField(value);
  }
  return out;
}
