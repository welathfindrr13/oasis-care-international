import { Masker } from '../masker';

describe('Masker', () => {
  it('masks e-mail', () => {
    expect(Masker.mask('john.doe@example.com')).toBe('j***@example.com');
  });

  it('masks UK mobile', () => {
    expect(Masker.mask('Call 07911 123 456')).toBe('Call 07*** *** ***');
  });

  it('masks multiple emails in text', () => {
    const input = 'Contact john.doe@example.com or jane.smith@company.co.uk';
    const expected = 'Contact j***@example.com or j***@company.co.uk';
    expect(Masker.mask(input)).toBe(expected);
  });

  it('masks multiple UK phone numbers', () => {
    const input = 'Call 07911 123 456 or 07123 456 789';
    const expected = 'Call 07*** *** *** or 07*** *** ***';
    expect(Masker.mask(input)).toBe(expected);
  });

  it('masks +44 UK phone format', () => {
    const input = 'International: +44 7911 123 456';
    const expected = 'International: 07*** *** ***';
    expect(Masker.mask(input)).toBe(expected);
  });

  it('leaves non-PII text unchanged', () => {
    const input = 'This is a regular text without PII';
    expect(Masker.mask(input)).toBe(input);
  });
});
