import { generateControlNumber, validateControlNumber } from './control-number';

describe('control numbers (Luhn-validated, 12 digits)', () => {
  it('generates a 12-digit numeric control number', () => {
    const cn = generateControlNumber('4821', 1);
    expect(cn).toMatch(/^\d{12}$/);
    expect(cn.startsWith('4821')).toBe(true);
  });

  it('round-trips: every generated number validates', () => {
    for (let seq = 1; seq < 500; seq += 17) {
      const cn = generateControlNumber('0042', seq);
      expect(validateControlNumber(cn)).toBe(true);
    }
  });

  it('detects single-digit tampering (the classic typo at the till)', () => {
    const cn = generateControlNumber('4821', 12345);
    for (let i = 0; i < cn.length; i++) {
      const flipped =
        cn.slice(0, i) + ((parseInt(cn[i]!, 10) + 1) % 10).toString() + cn.slice(i + 1);
      expect(validateControlNumber(flipped)).toBe(false);
    }
  });

  it('rejects malformed input', () => {
    expect(validateControlNumber('')).toBe(false);
    expect(validateControlNumber('12345')).toBe(false);
    expect(validateControlNumber('abcdefghijkl')).toBe(false);
    expect(validateControlNumber('1234567890123')).toBe(false); // 13 digits
  });

  it('different tenants never collide on the same sequence', () => {
    expect(generateControlNumber('1111', 7)).not.toEqual(generateControlNumber('2222', 7));
  });
});
