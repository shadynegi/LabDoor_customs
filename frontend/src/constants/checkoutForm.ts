import { getNames } from 'country-list';

/** Default country for checkout — must match a `country-list` option value exactly. */
export function resolveDefaultCheckoutCountry(): string {
  const names = getNames();
  const exact = names.find((name) => name === 'United States of America (the)');
  if (exact) return exact;
  const fuzzy = names.find((name) => /^United States/i.test(name));
  return fuzzy ?? '';
}
