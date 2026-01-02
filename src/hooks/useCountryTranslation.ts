import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import { countryNames } from '../data/countries';
import { getCountryAliases } from '../data/countryAliases';

interface SearchableCountry {
  original: string;
  translated: string;
  aliases: string[];
}

export function useCountryTranslation() {
  const { t, i18n } = useTranslation();

  // Translate a single country name
  const translateCountry = useCallback((name: string): string => {
    return t(`countries.${name}`, { defaultValue: name });
  }, [t]);

  // Get language-specific aliases
  const countryAliases = useMemo(() => {
    return getCountryAliases(i18n.language);
  }, [i18n.language]);

  // Get all translated country names with their original names and aliases
  const translatedCountries = useMemo((): SearchableCountry[] => {
    return countryNames.map(name => ({
      original: name,
      translated: translateCountry(name),
      aliases: countryAliases[name] || [],
    }));
  }, [translateCountry, countryAliases]);

  // Create Fuse instance for fuzzy search on translated names and aliases
  const fuse = useMemo(() => {
    return new Fuse(translatedCountries, {
      keys: [
        { name: 'translated', weight: 1 },
        { name: 'aliases', weight: 0.9 },
        { name: 'original', weight: 0.8 },
      ],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 1, // Allow single character matches for initialisms like "US"
      ignoreLocation: true, // Better matching for short strings like "UK"
    });
  }, [translatedCountries]);

  // Search countries by translated name, aliases, or original name
  const searchCountries = useCallback((query: string): string[] => {
    if (!query.trim()) return [];

    const normalizedQuery = query.trim().toUpperCase();
    const results: SearchableCountry[] = [];
    const seen = new Set<string>();

    // First, check for exact alias matches (case-insensitive) for initialisms
    for (const country of translatedCountries) {
      const hasExactAliasMatch = country.aliases.some(
        alias => alias.toUpperCase() === normalizedQuery
      );
      if (hasExactAliasMatch && !seen.has(country.original)) {
        results.push(country);
        seen.add(country.original);
      }
    }

    // Then do fuzzy search for other matches
    const fuseResults = fuse.search(query, { limit: 10 });
    for (const r of fuseResults) {
      if (!seen.has(r.item.original)) {
        results.push(r.item);
        seen.add(r.item.original);
      }
    }

    return results.slice(0, 8).map(r => r.original);
  }, [fuse, translatedCountries]);

  return {
    translateCountry,
    translatedCountries,
    searchCountries,
  };
}
