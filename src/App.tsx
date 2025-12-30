import { useTranslation } from 'react-i18next';
import { useBordersGame } from './hooks/useBordersGame';
import { useCountryTranslation } from './hooks/useCountryTranslation';
import { CountrySearch } from './components/CountrySearch';
import { CountryMap } from './components/CountryMap';
import { LanguageSelector } from './components/LanguageSelector';
import { GAME_CONFIG } from './types/game';
import './App.css';

function App() {
  const { t } = useTranslation();
  const { translateCountry } = useCountryTranslation();
  const {
    gameState,
    startGame,
    makeGuess,
    resetGame,
    showOutlinesHint,
    showNamesHint,
  } = useBordersGame();

  // Start screen
  if (!gameState) {
    return (
      <div className="app">
        <div className="background-grid" />
        <div className="background-glow" />

        <LanguageSelector />

        <header className="header">
          <h1 className="title">
            <span className="title-icon">🗺️</span>
            {t('app.title')}
          </h1>
          <p className="subtitle">{t('app.subtitle')}</p>
        </header>

        <main className="main">
          <div className="mode-selector">
            <button className="mode-card" onClick={startGame}>
              <div className="mode-icon">🎲</div>
              <h2 className="mode-title">{t('game.play')}</h2>
              <p className="mode-description">
                {t('game.playDescription')}
              </p>
            </button>
          </div>

          <div className="rules-card">
            <h3>{t('rules.title')}</h3>
            <ul>
              <li>{t('rules.rule1')}</li>
              <li>{t('rules.rule2')}</li>
              <li>{t('rules.rule3')}</li>
              <li>{t('rules.rule4')}</li>
              <li>{t('rules.rule5', { count: GAME_CONFIG.maxWrongAttempts })}</li>
            </ul>
          </div>
        </main>

        <footer className="footer">
          <span>{t('app.footer', { count: 150 })}</span>
        </footer>
      </div>
    );
  }

  const { currentCountry, guesses, correctGuesses, wrongGuesses, gameOver, won, showOutlines, namesHintLevel } = gameState;
  const bordersRemaining = currentCountry.borders.length - correctGuesses.length;
  const wrongAttemptsRemaining = GAME_CONFIG.maxWrongAttempts - wrongGuesses;

  // Get missing borders for name hints
  const missingBorders = currentCountry.borders.filter(
    border => !correctGuesses.some(g => g.toLowerCase() === border.toLowerCase())
  );

  // Function to format country name with hint
  const formatNameHint = (name: string, lettersToShow: number) => {
    const translatedName = translateCountry(name);
    if (lettersToShow >= translatedName.length) {
      return translatedName;
    }
    const visible = translatedName.slice(0, lettersToShow);
    const hidden = translatedName.slice(lettersToShow).replace(/[a-zA-Z\u00C0-\u024F]/g, '_');
    return visible + hidden;
  };

  // Game over screen
  if (gameOver) {
    const missedBorders = currentCountry.borders.filter(
      border => !correctGuesses.some(g => g.toLowerCase() === border.toLowerCase())
    );

    return (
      <div className="app">
        <div className="background-grid" />
        <div className="background-glow" />

        <LanguageSelector />

        <header className="header">
          <h1 className="title">
            <span className="title-icon">🗺️</span>
            {t('app.title')}
          </h1>
        </header>

        <main className="main">
          <div className="game-over-card">
            <div className={`game-over-header ${won ? 'won' : 'lost'}`}>
              {won ? (
                <>
                  <span className="game-over-icon">🎉</span>
                  <h2>{t('gameOver.congratulations')}</h2>
                  <p>{t('gameOver.foundAll', { count: currentCountry.borders.length, country: translateCountry(currentCountry.name) })}</p>
                </>
              ) : (
                <>
                  <span className="game-over-icon">😢</span>
                  <h2>{t('gameOver.gameOver')}</h2>
                  <p>{t('gameOver.ranOut', { country: translateCountry(currentCountry.name) })}</p>
                </>
              )}
            </div>

            <div className="game-over-stats">
              <div className="stat">
                <span className="stat-value">{correctGuesses.length}</span>
                <span className="stat-label">{t('gameOver.correct')}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{wrongGuesses}</span>
                <span className="stat-label">{t('gameOver.wrong')}</span>
              </div>
              <div className="stat">
                <span className="stat-value">{currentCountry.borders.length}</span>
                <span className="stat-label">{t('gameOver.totalBorders')}</span>
              </div>
            </div>

            <CountryMap
              targetCountry={currentCountry.name}
              guessedBorders={correctGuesses}
              allBorders={currentCountry.borders}
              gameOver={true}
            />

            {missedBorders.length > 0 && (
              <div className="missed-borders">
                <h3>{t('gameOver.missedBorders')}</h3>
                <div className="missed-list">
                  {missedBorders.map(border => (
                    <span key={border} className="missed-item">{translateCountry(border)}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="guesses-summary">
              <h3>{t('gameOver.yourGuesses')}</h3>
              <div className="guesses-list">
                {guesses.map((guess, index) => (
                  <span
                    key={index}
                    className={`guess-item ${guess.isCorrect ? 'correct' : 'wrong'}`}
                  >
                    {translateCountry(guess.countryName)}
                  </span>
                ))}
              </div>
            </div>

            <div className="game-over-actions">
              <button className="btn btn-primary" onClick={startGame}>
                {t('gameOver.playAgain')}
              </button>
              <button className="btn btn-secondary" onClick={resetGame}>
                {t('gameOver.backToMenu')}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Active game screen
  return (
    <div className="app">
      <div className="background-grid" />
      <div className="background-glow" />

      <LanguageSelector />

      <header className="header">
        <h1 className="title">
          <span className="title-icon">🗺️</span>
          {t('app.title')}
        </h1>
      </header>

      <main className="main">
        <div className="game-card">
          <div className="country-display">
            <span className="country-label">{t('game.findNeighbors')}</span>
            <h2 className="country-name">{translateCountry(currentCountry.name)}</h2>
          </div>

          <div className="game-status">
            <div className="status-item">
              <span className="status-value remaining">{bordersRemaining}</span>
              <span className="status-label">{t('game.bordersToFind')}</span>
            </div>
            <div className="status-item">
              <span className={`status-value ${wrongAttemptsRemaining <= 2 ? 'danger' : 'safe'}`}>
                {wrongAttemptsRemaining}
              </span>
              <span className="status-label">{t('game.wrongGuessesLeft')}</span>
            </div>
          </div>

          <CountryMap
            targetCountry={currentCountry.name}
            guessedBorders={correctGuesses}
            allBorders={currentCountry.borders}
            gameOver={false}
            showOutlines={showOutlines}
            wrongGuesses={guesses.filter(g => !g.isCorrect).map(g => g.countryName)}
          />

          {namesHintLevel > 0 && missingBorders.length > 0 && (
            <div className="names-hint">
              {missingBorders.map((border) => (
                <span key={border} className="hint-name">
                  {formatNameHint(border, namesHintLevel)}
                </span>
              ))}
            </div>
          )}

          <div className="hint-buttons">
            <button
              className="btn btn-hint"
              onClick={showOutlinesHint}
              disabled={showOutlines}
            >
              {t('hints.showOutlines')}
            </button>
            <button
              className="btn btn-hint"
              onClick={showNamesHint}
              disabled={namesHintLevel >= 3}
            >
              {t('hints.namesHint')}
            </button>
          </div>

          <CountrySearch
            onSelect={makeGuess}
            disabled={gameOver}
            alreadyGuessed={[...guesses.map(g => g.countryName), currentCountry.name]}
          />

          {guesses.length > 0 && (
            <div className="guesses-history">
              <div className="guesses-list">
                {guesses.map((guess, index) => (
                  <span
                    key={index}
                    className={`guess-item ${guess.isCorrect ? 'correct' : 'wrong'}`}
                  >
                    {translateCountry(guess.countryName)}
                    <span className="guess-icon">{guess.isCorrect ? '✓' : '✗'}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {correctGuesses.length > 0 && (
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${(correctGuesses.length / currentCountry.borders.length) * 100}%` }}
              />
              <span className="progress-text">
                {correctGuesses.length}/{currentCountry.borders.length} {t('game.found')}
              </span>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <button className="btn-link" onClick={resetGame}>
          ← {t('game.backToMenu')}
        </button>
      </footer>
    </div>
  );
}

export default App;
