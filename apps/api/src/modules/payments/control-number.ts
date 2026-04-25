/**
 * Luhn-validated 12-digit control number generator.
 * Format: TTTT-XXXXXX-C
 *   TTTT = tenant-specific prefix (4 digits)
 *   XXXXXX = sequential counter (6 digits)
 *   C = Luhn check digit
 *
 * GePG public-fee control numbers are issued by the Ministry of Finance
 * and NOT generated here — the GePGAdapter fetches them from the MoF API.
 */

export function generateControlNumber(tenantPrefix: string, sequence: number): string {
  const body = `${tenantPrefix.padStart(4, '0')}${sequence.toString().padStart(7, '0')}`;
  const check = luhnCheckDigit(body);
  return `${body}${check}`;
}

export function validateControlNumber(controlNo: string): boolean {
  if (!/^\d{12}$/.test(controlNo)) return false;
  const body = controlNo.slice(0, -1);
  const check = parseInt(controlNo.slice(-1), 10);
  return luhnCheckDigit(body) === check;
}

function luhnCheckDigit(partial: string): number {
  const digits = partial.split('').map(Number);
  let sum = 0;
  let shouldDouble = true;

  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i] ?? 0;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}
