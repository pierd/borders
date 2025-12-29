import { useTranslation } from 'react-i18next';
import { supportedLanguages, type SupportedLanguage } from '../i18n';

const languageFlags: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  pl: '🇵🇱',
  es: '🇪🇸',
};

export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const currentLang = (i18n.language?.substring(0, 2) || 'en') as SupportedLanguage;

  const handleChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="language-selector">
      {supportedLanguages.map((lang) => (
        <button
          key={lang}
          onClick={() => handleChange(lang)}
          className={`lang-btn ${currentLang === lang ? 'active' : ''}`}
          title={t(`language.${lang}`)}
          aria-label={t(`language.${lang}`)}
        >
          <span className="lang-flag">{languageFlags[lang]}</span>
        </button>
      ))}
    </div>
  );
}
