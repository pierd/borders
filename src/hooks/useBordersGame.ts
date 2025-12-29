import { useState, useCallback } from 'react';
import { countries, type Country } from '../data/countries';
import { GAME_CONFIG } from '../types/game';

export interface Guess {
  countryName: string;
  isCorrect: boolean;
}

export interface GameState {
  currentCountry: Country;
  guesses: Guess[];
  correctGuesses: string[];
  wrongGuesses: number;
  gameOver: boolean;
  won: boolean;
}

// Simple seeded random number generator
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function getRandomCountry(): Country {
  // Use current timestamp as seed for true randomness
  const random = seededRandom(Date.now());
  // Filter countries to only those with at least 2 borders (more interesting)
  const validCountries = countries.filter(c => c.borders.length >= 2);
  const index = Math.floor(random() * validCountries.length);
  return validCountries[index];
}

export function useBordersGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const startGame = useCallback(() => {
    const country = getRandomCountry();
    setGameState({
      currentCountry: country,
      guesses: [],
      correctGuesses: [],
      wrongGuesses: 0,
      gameOver: false,
      won: false,
    });
  }, []);

  const makeGuess = useCallback((countryName: string) => {
    if (!gameState || gameState.gameOver) return;

    // Check if already guessed
    if (gameState.guesses.some(g => g.countryName.toLowerCase() === countryName.toLowerCase())) {
      return;
    }

    // Check if the guess is the target country itself
    if (countryName.toLowerCase() === gameState.currentCountry.name.toLowerCase()) {
      return;
    }

    const isCorrect = gameState.currentCountry.borders
      .map(b => b.toLowerCase())
      .includes(countryName.toLowerCase());

    const newGuess: Guess = {
      countryName,
      isCorrect,
    };

    const newGuesses = [...gameState.guesses, newGuess];
    const newCorrectGuesses = isCorrect
      ? [...gameState.correctGuesses, countryName]
      : gameState.correctGuesses;
    const newWrongGuesses = isCorrect ? gameState.wrongGuesses : gameState.wrongGuesses + 1;

    // Check win condition - all borders found
    const allBordersFound = gameState.currentCountry.borders.every(border =>
      newCorrectGuesses.some(g => g.toLowerCase() === border.toLowerCase())
    );

    // Check lose condition - max wrong guesses reached
    const maxWrongReached = newWrongGuesses >= GAME_CONFIG.maxWrongAttempts;

    setGameState({
      ...gameState,
      guesses: newGuesses,
      correctGuesses: newCorrectGuesses,
      wrongGuesses: newWrongGuesses,
      gameOver: allBordersFound || maxWrongReached,
      won: allBordersFound,
    });
  }, [gameState]);

  const resetGame = useCallback(() => {
    setGameState(null);
  }, []);

  return {
    gameState,
    startGame,
    makeGuess,
    resetGame,
  };
}
