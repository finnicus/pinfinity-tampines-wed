import { getLogoSrc } from '../js/App';

describe('getLogoSrc', () => {
  test('returns tessensohn logo when logoName is tessensohn', () => {
    const logoSrc = getLogoSrc('tessensohn');
    expect(String(logoSrc)).toContain('tessensohn.png');
  });

  test('normalizes whitespace and casing for tessensohn logoName', () => {
    const logoSrc = getLogoSrc('  TeSsEnSoHn  ');
    expect(String(logoSrc)).toContain('tessensohn.png');
  });

  test('falls back to generic logo for unknown logoName', () => {
    const logoSrc = getLogoSrc('unknown-league-logo');
    expect(String(logoSrc)).toContain('generic.png');
  });
});
