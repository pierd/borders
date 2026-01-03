import { LanguageSelector as LanguageSelectorBase } from 'lessismore-react';
import { supportedLanguages, type SupportedLanguage } from '../i18n';

const languageFlags: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  pl: '🇵🇱',
  es: '🇪🇸',
};

export function LanguageSelector() {
  return <LanguageSelectorBase languages={supportedLanguages} flags={languageFlags} />;
}
