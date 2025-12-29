import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import { countryNames } from '../data/countries';

export function useCountryTranslation() {
  const { t } = useTranslation();

  // Translate a single country name
  const translateCountry = useCallback((name: string): string => {
    return t(`countries.${name}`, { defaultValue: name });
  }, [t]);

  // Get all translated country names with their original names
  const translatedCountries = useMemo(() => {
    return countryNames.map(name => ({
      original: name,
      translated: translateCountry(name),
    }));
  }, [translateCountry]);

  // Create Fuse instance for fuzzy search on translated names
  const fuse = useMemo(() => {
    return new Fuse(translatedCountries, {
      keys: ['translated'],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 2,
    });
  }, [translatedCountries]);

  // Search countries by translated name, return original names
  const searchCountries = useCallback((query: string): string[] => {
    if (!query.trim()) return [];
    const results = fuse.search(query, { limit: 8 });
    return results.map(r => r.item.original);
  }, [fuse]);

  return {
    translateCountry,
    translatedCountries,
    searchCountries,
  };
}
