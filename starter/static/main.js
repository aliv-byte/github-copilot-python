// Client-side rendering and interaction for the Flask-backed Sudoku
import {formatTime, renderScoreboard, saveScore} from './scoreboard.js';

const SIZE = 9;
let timerStartedAt = null;
let timerInterval = null;
let hintsUsed = 0;
let currentDifficulty = 'easy';
let currentTimeSeconds = 0;
let gameSolved = false;

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
  msg.style.color = isError ? '#d32f2f' : '#388e3c';
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
  currentTimeSeconds = 0;
  hintsUsed = 0;
  gameSolved = false;
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('hints-used').textContent = '0';
  document.getElementById('score-form').hidden = true;
  document.getElementById('player-name').value = '';
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
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = board[row][col];
      if (!value) continue;

      const hasConflict = (otherRow, otherCol) =>
        (otherRow !== row || otherCol !== col) &&
        board[otherRow][otherCol] === value &&
        (otherRow === row ||
          otherCol === col ||
          (Math.floor(otherRow / 3) === Math.floor(row / 3) &&
            Math.floor(otherCol / 3) === Math.floor(col / 3)));

      if (board.some((line, otherRow) =>
        line.some((_, otherCol) => hasConflict(otherRow, otherCol))
      )) {
        inputs[row * SIZE + col].classList.add('conflict');
      }
    }
  }
}

function handleCellInput(event) {
  const input = event.target;
  if (!input.matches('.sudoku-cell') || input.readOnly) return;

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
  if (readBoard().every((row) => row.every((value) => value !== 0))) {
    checkSolution();
  }
}

async function checkSolution() {
  if (gameSolved) return;
  try {
    const data = await requestJson('/check', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({board: readBoard()})
    });
    const inputs = document.querySelectorAll('#sudoku-board .sudoku-cell');
    inputs.forEach((input) => input.classList.remove('incorrect'));
    data.incorrect.forEach(([row, col]) => {
      inputs[row * SIZE + col].classList.add('incorrect');
    });

    if (data.solved) {
      gameSolved = true;
      stopTimer();
      showMessage(
        `Congratulations! You solved the puzzle in ${formatTime(currentTimeSeconds)} with ${hintsUsed} hints.`,
        false
      );
      document.getElementById('score-form').hidden = false;
    } else if (data.incorrect.length) {
      showMessage('Some entries are incorrect. Check the highlighted cells.');
    } else {
      showMessage('No mistakes so far. Keep going!', false);
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
  if (!gameSolved) return;

  const result = saveScore({
    name: document.getElementById('player-name').value,
    time: currentTimeSeconds,
    difficulty: currentDifficulty,
    hints: hintsUsed
  });
  if (result.status === 'saved') {
    renderScoreboard();
    document.getElementById('score-form').hidden = true;
  }
  document.getElementById('scoreboard-message').textContent = result.message;
}

window.addEventListener('load', () => {
  renderScoreboard();
  document.getElementById('sudoku-board').addEventListener('input', handleCellInput);
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('get-hint').addEventListener('click', getHint);
  document.getElementById('score-form').addEventListener('submit', handleScoreSave);
  newGame();
});