export const SCOREBOARD_KEY = 'sudokuTop10';
const MAX_SCORES = 10;
const DIFFICULTIES = ['easy', 'medium', 'hard'];

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isValidScore(score) {
  return score &&
    typeof score.name === 'string' &&
    Number.isInteger(score.time) &&
    score.time >= 0 &&
    DIFFICULTIES.includes(score.difficulty) &&
    Number.isInteger(score.hints) &&
    score.hints >= 0;
}

function readScores() {
  try {
    const storedScores = window.localStorage.getItem(SCOREBOARD_KEY);
    if (storedScores === null) return {scores: [], error: null};

    const scores = JSON.parse(storedScores);
    if (!Array.isArray(scores) || !scores.every(isValidScore)) {
      throw new Error('Saved scores have an invalid format.');
    }
    return {scores: scores.sort((first, second) =>
      first.time - second.time
    ).slice(0, MAX_SCORES), error: null};
  } catch {
    return {
      scores: [],
      error: 'Saved scores could not be loaded. Browser storage may be unavailable or the saved data is invalid.'
    };
  }
}

export function renderScoreboard(highlightRank = null) {
  const {scores, error} = readScores();
  const tableBody = document.getElementById('scoreboard-body');
  const message = document.getElementById('scoreboard-message');
  tableBody.replaceChildren();
  message.textContent = error || '';

  if (!scores.length) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = error ? 'Scores are currently unavailable.' : 'No scores yet.';
    return;
  }

  scores.forEach((score, index) => {
    const row = tableBody.insertRow();
    if (index + 1 === highlightRank) {
      row.classList.add('scoreboard-new-entry');
      window.setTimeout(() => {
        row.classList.remove('scoreboard-new-entry');
      }, 2500);
    }
    [
      String(index + 1),
      score.name,
      formatTime(score.time),
      score.difficulty,
      String(score.hints)
    ].forEach((value) => {
      row.insertCell().textContent = value;
    });
  });
}

export function saveScore(score) {
  if (!score || typeof score !== 'object') {
    return {status: 'error', message: 'This score could not be saved because its details are invalid.'};
  }
  const {scores, error} = readScores();
  if (error) return {status: 'error', message: error};

  const name = typeof score.name === 'string'
    ? score.name.trim().slice(0, 20) || 'Anonymous'
    : 'Anonymous';
  const newScore = {
    name,
    time: score.time,
    difficulty: score.difficulty,
    hints: score.hints
  };
  if (!isValidScore(newScore)) {
    return {status: 'error', message: 'This score could not be saved because its details are invalid.'};
  }

  if (scores.length === MAX_SCORES &&
      newScore.time >= scores[scores.length - 1].time) {
    return {status: 'not-qualified', message: 'Your time did not make the Top 10. Keep practicing!'};
  }

  const updatedScores = [...scores, newScore]
    .sort((first, second) => first.time - second.time)
    .slice(0, MAX_SCORES);
  try {
    window.localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(updatedScores));
  } catch {
    return {
      status: 'error',
      message: 'Your score could not be saved because browser storage is unavailable.'
    };
  }

  return {
    status: 'saved',
    message: 'Your score was saved to the Top 10.',
    rank: updatedScores.indexOf(newScore) + 1
  };
}
