import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCountryTranslation } from '../hooks/useCountryTranslation';

interface CountrySearchProps {
  onSelect: (country: string) => void;
  disabled?: boolean;
  alreadyGuessed: string[];
}

export function CountrySearch({ onSelect, disabled, alreadyGuessed }: CountrySearchProps) {
  const { t } = useTranslation();
  const { searchCountries, translateCountry } = useCountryTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const updateSuggestions = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(-1);

    if (value.trim()) {
      const results = searchCountries(value).filter(
        country => !alreadyGuessed.some(g => g.toLowerCase() === country.toLowerCase())
      );
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [searchCountries, alreadyGuessed]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSuggestions(e.target.value);
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeInput = () => {
      updateSuggestions(input.value);
    };

    input.addEventListener('input', handleNativeInput);
    return () => input.removeEventListener('input', handleNativeInput);
  }, [updateSuggestions]);

  const selectCountry = useCallback((country: string) => {
    onSelect(country);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectCountry(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          selectCountry(suggestions[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-container" ref={containerRef}>
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        <span className="search-icon">🔍</span>
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((country, index) => (
            <li
              key={country}
              className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => selectCountry(country)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="suggestion-country">{translateCountry(country)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
