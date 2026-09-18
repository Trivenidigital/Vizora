import {
  applyCSSVariables,
  defaultBrandConfig,
  isUnbrandedDefault,
  type BrandConfig,
} from '../customization';

/**
 * The guard that decides whether `--primary` gets an inline override.
 *
 * This is not a cosmetic detail. `applyCSSVariables` writes `--primary` as an
 * INLINE STYLE on <html>, which outranks every stylesheet rule, so whatever
 * this predicate answers decides the brand colour for the entire authenticated
 * app — the sidebar, the focus ring, every `.eh-btn-neon`. The previous guard
 * (`config.id !== 'default'`) expressed the right intent and never matched it,
 * because the branding API stamps a real org id on the config it returns. The
 * result was that the retired Electric Horizon neon beat the Little Worlds
 * palette for every signed-in tenant, and `.eh-btn-neon`'s label measured
 * 1.43:1 in a live audit.
 *
 * A separate file from `customization-ink.test.ts` on purpose: that one is
 * pinned by the redesign plan as "must stay green, unedited", so nothing new
 * goes into it.
 */

/** A config shaped the way `CustomizationProvider` builds one from the API. */
function apiConfig(overrides: Partial<BrandConfig> = {}): BrandConfig {
  return {
    id: '4186699a-6f5a-498e-9dff-a98caf6969da',
    name: 'Northwind Coffee Roasters',
    primaryColor: defaultBrandConfig.primaryColor,
    secondaryColor: defaultBrandConfig.secondaryColor,
    accentColor: defaultBrandConfig.accentColor,
    fontFamily: 'sans',
    showPoweredBy: true,
    ...overrides,
  };
}

describe('isUnbrandedDefault', () => {
  it('recognises the untouched default triple even under a real org id', () => {
    // The exact case the old guard missed.
    expect(isUnbrandedDefault(apiConfig())).toBe(true);
  });

  it('does not treat a real tenant colour as unbranded', () => {
    expect(isUnbrandedDefault(apiConfig({ primaryColor: '#7C3AED' }))).toBe(false);
  });

  it('is case-insensitive — the server may echo a different hex case', () => {
    expect(
      isUnbrandedDefault(
        apiConfig({
          primaryColor: defaultBrandConfig.primaryColor.toLowerCase(),
          secondaryColor: defaultBrandConfig.secondaryColor.toLowerCase(),
          accentColor: defaultBrandConfig.accentColor.toLowerCase(),
        }),
      ),
    ).toBe(true);
  });

  it('ignores non-colour fields — a tenant may set a name or logo and no colour', () => {
    expect(isUnbrandedDefault(apiConfig({ name: 'Anything', logo: '/x.png' }))).toBe(true);
  });

  it('treats a partial match as branded — one changed channel is still a choice', () => {
    expect(isUnbrandedDefault(apiConfig({ accentColor: '#123456' }))).toBe(false);
  });
});

describe('applyCSSVariables and the --primary override', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--brand-ink-light');
  });

  const primary = () => document.documentElement.style.getPropertyValue('--primary');
  const ink = () => document.documentElement.style.getPropertyValue('--brand-ink-light');

  it('writes NOTHING inline for an unbranded tenant, so :root wins', () => {
    applyCSSVariables(apiConfig());
    expect(primary()).toBe('');
    expect(ink()).toBe('');
  });

  it('still overrides for a tenant that chose a colour', () => {
    applyCSSVariables(apiConfig({ primaryColor: '#7C3AED' }));
    expect(primary()).toBe('#7C3AED');
    // Derived, not asserted as a literal — see customization-ink.test.ts.
    expect(ink()).not.toBe('');
  });

  /**
   * The reason the unbranded branch REMOVES rather than skips.
   *
   * `CustomizationProvider` calls this twice — once with the localStorage cache
   * for a fast first paint, then with the API's answer. A tenant who clears
   * their brand colour, or a cached config from another org, would otherwise
   * leave a stale inline `--primary` outranking `:root` for the whole session.
   */
  it('undoes a previous branded write when branding is cleared', () => {
    applyCSSVariables(apiConfig({ primaryColor: '#7C3AED' }));
    expect(primary()).toBe('#7C3AED');

    applyCSSVariables(apiConfig());
    expect(primary()).toBe('');
    expect(ink()).toBe('');
  });

  it('leaves the literal default config alone too (id === "default")', () => {
    applyCSSVariables(defaultBrandConfig);
    expect(primary()).toBe('');
  });
});
