"""Sudoku board generation, solving, and uniqueness checks."""

import copy
import random

SIZE = 9
EMPTY = 0
DIFFICULTY_CLUES = {
    "easy": 40,
    "medium": 32,
    "hard": 26,
}

Board = list[list[int]]


def create_empty_board() -> Board:
    """Return a blank 9x9 Sudoku board."""
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def _candidates(board: Board, row: int, col: int) -> list[int]:
    """Return digits that can legally go in a cell."""
    used = set(board[row])
    used.update(board[index][col] for index in range(SIZE))
    box_row = row - row % 3
    box_col = col - col % 3
    used.update(
        board[box_row + row_offset][box_col + col_offset]
        for row_offset in range(3)
        for col_offset in range(3)
    )
    return [digit for digit in range(1, SIZE + 1) if digit not in used]


def _is_valid_board(board: Board) -> bool:
    """Check board dimensions, digit range, and existing Sudoku conflicts."""
    if len(board) != SIZE or any(len(row) != SIZE for row in board):
        return False

    units = list(board)
    units.extend(
        [[board[row][col] for row in range(SIZE)] for col in range(SIZE)]
    )
    units.extend(
        [
            [
                board[box_row + row_offset][box_col + col_offset]
                for row_offset in range(3)
                for col_offset in range(3)
            ]
            for box_row in range(0, SIZE, 3)
            for box_col in range(0, SIZE, 3)
        ]
    )
    for unit in units:
        values = [value for value in unit if value != EMPTY]
        if any(not isinstance(value, int) or not 1 <= value <= SIZE for value in values):
            return False
        if len(values) != len(set(values)):
            return False
    return True


def _most_constrained_empty(
    board: Board,
) -> tuple[int, int, list[int]] | None:
    """Find an empty cell with the fewest legal values."""
    best: tuple[int, int, list[int]] | None = None
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] != EMPTY:
                continue
            possible = _candidates(board, row, col)
            if best is None or len(possible) < len(best[2]):
                best = (row, col, possible)
            if not possible:
                return best
    return best


def _fill_randomly(board: Board) -> bool:
    """Fill a blank board using randomized backtracking."""
    cell = _most_constrained_empty(board)
    if cell is None:
        return True

    row, col, possible = cell
    random.shuffle(possible)
    for digit in possible:
        board[row][col] = digit
        if _fill_randomly(board):
            return True
        board[row][col] = EMPTY
    return False


def generate_solved_board() -> Board:
    """Generate a fully solved valid 9x9 Sudoku board."""
    board = create_empty_board()
    if not _fill_randomly(board):
        raise RuntimeError("Unable to generate a solved Sudoku board")
    return board


def solve_board(board: Board) -> bool:
    """Solve a Sudoku board in place, returning whether it is solvable."""
    if not _is_valid_board(board):
        return False

    def search() -> bool:
        cell = _most_constrained_empty(board)
        if cell is None:
            return True

        row, col, possible = cell
        for digit in possible:
            board[row][col] = digit
            if search():
                return True
            board[row][col] = EMPTY
        return False

    return search()


def count_solutions(board: Board) -> int:
    """Count solutions, stopping as soon as a second one is found."""
    if not _is_valid_board(board):
        return 0

    working = copy.deepcopy(board)
    count = 0

    def search() -> None:
        nonlocal count
        if count >= 2:
            return
        cell = _most_constrained_empty(working)
        if cell is None:
            count += 1
            return

        row, col, possible = cell
        for digit in possible:
            working[row][col] = digit
            search()
            working[row][col] = EMPTY
            if count >= 2:
                return

    search()
    return count


def generate_puzzle(difficulty: str = "easy") -> tuple[Board, Board]:
    """Generate a puzzle with the clue count assigned to its difficulty."""
    if difficulty not in DIFFICULTY_CLUES:
        choices = ", ".join(DIFFICULTY_CLUES)
        raise ValueError(f"Invalid difficulty. Choose {choices}.")

    target_clues = DIFFICULTY_CLUES[difficulty]
    while True:
        solution = generate_solved_board()
        puzzle = copy.deepcopy(solution)
        cells = [(row, col) for row in range(SIZE) for col in range(SIZE)]
        random.shuffle(cells)

        for row, col in cells:
            if sum(value != EMPTY for line in puzzle for value in line) <= target_clues:
                break
            removed = puzzle[row][col]
            puzzle[row][col] = EMPTY
            # Keep each removal only if it preserves a unique solution.
            if count_solutions(puzzle) != 1:
                puzzle[row][col] = removed

        if sum(value != EMPTY for line in puzzle for value in line) == target_clues:
            return puzzle, solution
