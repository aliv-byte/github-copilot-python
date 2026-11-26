// Client-side rendering and interaction for the Flask-backed Sudoku
import {formatTime, renderScoreboard, saveScore} from './scoreboard.js';

const SIZE = 9;
let timerStartedAt = null;
let timerInterval = null;
let hintsUsed = 0;
let currentDifficulty = 'easy';
let currentTimeSeconds = 0;
let gameSolved = false;
let boardRevision = 0;

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.inputMode = 'numeric';
      input.className = 'sudoku-cell';
      input.dataset.row = i;
      input.dataset.col = j;
      input.setAttribute('aria-label', `Row ${i + 1}, column ${j + 1}`);
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function renderPuzzle(puz) {
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puz[i][j];
      const inp = inputs[idx];
      inp.value = '';
      inp.readOnly = false;
      inp.className = 'sudoku-cell';
      if (val !== 0) {
        inp.value = val;
        inp.readOnly = true;
        inp.classList.add('prefilled');
      }
    }
  }
  updateConflicts();
}

function showMessage(message, isError = true) {
  const msg = document.getElementById('message');
  msg.textContent = message;
  msg.classList.toggle('message-success', !isError);
  msg.classList.toggle('message-error', isError);
}

function updateThemeToggle(theme) {
  const toggle = document.getElementById('theme-toggle');
  const isDark = theme === 'dark';
  toggle.textContent = isDark ? 'Light mode' : 'Dark mode';
  toggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  toggle.setAttribute('aria-pressed', String(isDark));
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  updateThemeToggle(theme);
  try {
    window.localStorage.setItem('sudokuTheme', theme);
  } catch {
    showMessage('Theme changed, but your preference could not be saved.');
  }
}

function updateTimer() {
  if (timerStartedAt === null) return;
  currentTimeSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
  document.getElementById('timer').textContent = formatTime(currentTimeSeconds);
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
  updateTimer();
  timerStartedAt = null;
}

function resetGameStatus() {
  stopTimer();
  boardRevision += 1;
  currentTimeSeconds = 0;
  hintsUsed = 0;
  gameSolved = false;
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('hints-used').textContent = '0';
  document.getElementById('victory-banner').hidden = true;
  document.getElementById('score-form').hidden = true;
  document.getElementById('player-name').value = '';
  document.getElementById('player-name').disabled = false;
  document.getElementById('save-score').disabled = false;
  document.getElementById('victory-save-message').textContent = '';
}

function startTimer() {
  timerStartedAt = Date.now();
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 250);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The game server returned an unreadable response.');
  }
  if (!response.ok) {
    throw new Error(data.error || 'The request could not be completed.');
  }
  return data;
}

async function newGame() {
  const difficulty = document.getElementById('difficulty').value;
  resetGameStatus();
  currentDifficulty = difficulty;
  try {
    const data = await requestJson(`/new?difficulty=${encodeURIComponent(difficulty)}`);
    if (!Array.isArray(data.puzzle) || data.puzzle.length !== SIZE) {
      throw new Error('The server returned an invalid puzzle. Please try again.');
    }
    renderPuzzle(data.puzzle);
    startTimer();
    showMessage('', false);
  } catch (error) {
    showMessage(error.message || 'Unable to start a new game.');
  }
}

function readBoard() {
  const inputs = document.querySelectorAll('#sudoku-board .sudoku-cell');
  return Array.from({length: SIZE}, (_, row) =>
    Array.from({length: SIZE}, (_, col) => {
      const value = inputs[row * SIZE + col].value;
      return value ? Number(value) : 0;
    })
  );
}

function updateConflicts() {
  const inputs = document.querySelectorAll('#sudoku-board .sudoku-cell');
  inputs.forEach((input) => input.classList.remove('conflict'));
  const board = readBoard();
  const units = [];

  for (let index = 0; index < SIZE; index++) {
    units.push(
      Array.from({length: SIZE}, (_, offset) => index * SIZE + offset),
      Array.from({length: SIZE}, (_, offset) => offset * SIZE + index)
    );
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += 3) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += 3) {
      units.push(
        Array.from({length: SIZE}, (_, offset) =>
          (boxRow + Math.floor(offset / 3)) * SIZE +
          boxCol + offset % 3
        )
      );
    }
  }

  units.forEach((unit) => {
    const cellsByValue = new Map();
    unit.forEach((index) => {
      const value = board[Math.floor(index / SIZE)][index % SIZE];
      if (!value) return;
      const cells = cellsByValue.get(value) || [];
      cells.push(index);
      cellsByValue.set(value, cells);
    });

    cellsByValue.forEach((cells) => {
      if (cells.length > 1) {
        cells.forEach((index) => inputs[index].classList.add('conflict'));
      }
    });
  });
}

function handleCellInput(event) {
  const input = event.target;
  if (!input.matches('.sudoku-cell') || input.readOnly) return;
  boardRevision += 1;

  if (input.value && !/^[1-9]$/.test(input.value)) {
    input.value = '';
    showMessage('Enter a single digit from 1 to 9.');
  } else {
    showMessage('', false);
  }

  document.querySelectorAll('#sudoku-board .incorrect').forEach((cell) => {
    cell.classList.remove('incorrect');
  });
  updateConflicts();

  checkIfComplete();
}

function checkIfComplete() {
  const board = readBoard();
  if (board.every((row) => row.every((value) => value !== 0))) {
    checkSolution(board, boardRevision);
  }
}

async function checkSolution(board = readBoard(), revision = boardRevision) {
  if (gameSolved) return;
  try {
    const data = await requestJson('/check', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({board})
    });
    if (revision !== boardRevision || gameSolved) return;

    const inputs = document.querySelectorAll('#sudoku-board .sudoku-cell');
    inputs.forEach((input) => input.classList.remove('incorrect'));
    data.incorrect.forEach(([row, col]) => {
      inputs[row * SIZE + col].classList.add('incorrect');
    });

    if (data.solved) {
      gameSolved = true;
      stopTimer();
      document.getElementById('victory-time').textContent = formatTime(currentTimeSeconds);
      document.getElementById('victory-hints').textContent = String(hintsUsed);
      document.getElementById('victory-banner').hidden = false;
      document.getElementById('score-form').hidden = false;
      showMessage('', false);
    } else if (data.incorrect.length) {
      const count = data.incorrect.length;
      showMessage(
        `${count} incorrect cell${count === 1 ? '' : 's'}.`,
        true
      );
    } else {
      showMessage('No mistakes so far.', false);
    }
  } catch (error) {
    showMessage(error.message || 'Unable to check the puzzle.');
  }
}

async function getHint() {
  try {
    const data = await requestJson('/hint', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({board: readBoard()})
    });
    const input = document.querySelector(
      `#sudoku-board .sudoku-cell[data-row="${data.row}"][data-col="${data.col}"]`
    );
    if (!input || input.readOnly || !/^[1-9]$/.test(String(data.value))) {
      throw new Error('The server returned an invalid hint. Please try again.');
    }
    input.value = data.value;
    input.readOnly = true;
    input.classList.add('hinted');
    boardRevision += 1;
    hintsUsed += 1;
    document.getElementById('hints-used').textContent = String(hintsUsed);
    updateConflicts();
    showMessage('A correct cell has been filled in and locked.', false);
    checkIfComplete();
  } catch (error) {
    showMessage(error.message || 'Unable to get a hint.');
  }
}

function handleScoreSave(event) {
  event.preventDefault();
  if (!gameSolved || document.getElementById('save-score').disabled) return;

  const result = saveScore({
    name: document.getElementById('player-name').value,
    time: currentTimeSeconds,
    difficulty: currentDifficulty,
    hints: hintsUsed
  });
  if (result.status === 'saved') {
    document.getElementById('victory-save-message').textContent =
      `Saved! You are rank #${result.rank} of 10`;
    document.getElementById('player-name').disabled = true;
    document.getElementById('save-score').disabled = true;
    document.getElementById('scoreboard-message').textContent = '';
    renderScoreboard(result.rank);
    document.querySelector('.scoreboard').scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  } else if (result.status === 'not-qualified') {
    document.getElementById('victory-save-message').textContent =
      "Your time didn't make the Top 10";
    document.getElementById('scoreboard-message').textContent = '';
  } else {
    document.getElementById('scoreboard-message').textContent = result.message;
  }
}

window.addEventListener('load', () => {
  updateThemeToggle(document.documentElement.dataset.theme || 'light');
  renderScoreboard();
  document.getElementById('sudoku-board').addEventListener('input', handleCellInput);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('get-hint').addEventListener('click', getHint);
  document.getElementById('score-form').addEventListener('submit', handleScoreSave);
  newGame();
});