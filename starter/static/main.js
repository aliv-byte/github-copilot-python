// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;

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
      const val = puzzle[i][j];
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
  msg.innerText = message;
  msg.style.color = isError ? '#d32f2f' : '#388e3c';
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
  try {
    const data = await requestJson(`/new?difficulty=${encodeURIComponent(difficulty)}`);
    if (!Array.isArray(data.puzzle) || data.puzzle.length !== SIZE) {
      throw new Error('The server returned an invalid puzzle. Please try again.');
    }
    renderPuzzle(data.puzzle);
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

  if (input.value && readBoard().every((row) => row.every((value) => value !== 0))) {
    checkSolution();
  }
}

async function checkSolution() {
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
      showMessage('Congratulations! You solved the puzzle!', false);
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
    updateConflicts();
    showMessage('A correct cell has been filled in and locked.', false);
    if (readBoard().every((row) => row.every((value) => value !== 0))) {
      await checkSolution();
    }
  } catch (error) {
    showMessage(error.message || 'Unable to get a hint.');
  }
}

window.addEventListener('load', () => {
  document.getElementById('sudoku-board').addEventListener('input', handleCellInput);
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  document.getElementById('get-hint').addEventListener('click', getHint);
  newGame();
});