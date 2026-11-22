/** A language app's colors follow its own icon (the family stays coherent, each app is recognisable). */
import { palettes } from '../src/theme/palettes';
import { colors } from '../src/theme/colors';
import es from '../variants/es.json';

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('palettes', () => {
  it('has one palette per language, all with the same keys', () => {
    expect(Object.keys(palettes).sort()).toEqual(['de', 'es', 'fr']);
    expect(Object.keys(palettes.es).sort()).toEqual(Object.keys(palettes.de).sort());
  });
  it('keeps the German app exactly as released', () => {
    expect(palettes.de.primary).toBe('#1E4A67');
    expect(palettes.de.paper).toBe('#F6F9FB');
  });
  it('gives Spanish the color of its icon', () => {
    expect(palettes.es.primary.toLowerCase()).toBe(es.adaptiveIcon.background.toLowerCase());
    expect(palettes.es.primary).not.toBe(palettes.de.primary);
  });
  it('gives French its own blue, different from the other two apps', () => {
    expect(palettes.fr.primary).toBe('#0055A4');
    expect(palettes.fr.primary).not.toBe(palettes.de.primary);
    expect(palettes.fr.primary).not.toBe(palettes.es.primary);
    expect(Object.keys(palettes.fr).sort()).toEqual(Object.keys(palettes.de).sort());
  });
  it.each(['de', 'es', 'fr'] as const)('%s: text and buttons stay readable', (code) => {
    const p = palettes[code];
    expect(contrast('#FFFFFF', p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.ink, p.paper)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.muted, p.paper)).toBeGreaterThanOrEqual(4.5);
  });
  it('the active theme is the active language palette', () => {
    expect(colors.primary).toBe(palettes.de.primary); // the repo seam is German
    expect(colors.forest).toBe(colors.primary);
  });
});
