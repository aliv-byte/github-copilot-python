import pytest

import sudoku_logic
from app import CURRENT


def make_solved_board():
    """Build a deterministic complete Sudoku board for route tests."""
    return [
        [((row * 3 + row // 3 + col) % 9) + 1 for col in range(9)]
        for row in range(9)
    ]


def test_home_route_returns_200(client):
    response = client.get("/")

    assert response.status_code == 200


def test_new_route_returns_200(client):
    response = client.get("/new")

    assert response.status_code == 200
    assert set(response.get_json()) == {"puzzle"}


@pytest.mark.parametrize(
    ("difficulty", "expected_clues"),
    [("easy", 40), ("medium", 32), ("hard", 26)],
)
def test_new_route_generates_unique_puzzle_with_expected_clues(
    client, difficulty, expected_clues
):
    response = client.get(f"/new?difficulty={difficulty}")
    puzzle = response.get_json()["puzzle"]

    assert response.status_code == 200
    assert sum(value != sudoku_logic.EMPTY for row in puzzle for value in row) == (
        expected_clues
    )
    assert sudoku_logic.count_solutions(puzzle) == 1


def test_new_route_rejects_invalid_difficulty(client):
    response = client.get("/new?difficulty=impossible")

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Invalid difficulty. Choose easy, medium, hard."
    }


def test_check_route_reports_incorrect_cells_and_completion(client):
    solution = make_solved_board()
    puzzle = [row.copy() for row in solution]
    puzzle[0][0] = sudoku_logic.EMPTY
    puzzle[0][1] = sudoku_logic.EMPTY
    CURRENT["puzzle"] = puzzle
    CURRENT["solution"] = solution

    response = client.post("/check", json={"board": puzzle})

    assert response.status_code == 200
    assert response.get_json() == {"incorrect": [], "solved": False}

    response = client.post("/check", json={"board": solution})

    assert response.get_json() == {"incorrect": [], "solved": True}

    completed_board = [row.copy() for row in solution]
    completed_board[0][1] = 9
    response = client.post("/check", json={"board": completed_board})

    assert response.get_json() == {"incorrect": [[0, 1]], "solved": False}


def test_check_route_reports_every_incorrect_non_prefilled_cell(client):
    solution = make_solved_board()
    puzzle = [row.copy() for row in solution]
    wrong_cells = [(row, col) for row in range(2) for col in range(5)]
    for row, col in wrong_cells:
        puzzle[row][col] = sudoku_logic.EMPTY
    CURRENT["puzzle"] = puzzle
    CURRENT["solution"] = solution

    board = [row.copy() for row in puzzle]
    for row, col in wrong_cells:
        board[row][col] = solution[row][col] % sudoku_logic.SIZE + 1
    board[8][8] = solution[8][8] % sudoku_logic.SIZE + 1

    response = client.post("/check", json={"board": board})

    assert response.status_code == 200
    assert response.get_json() == {
        "incorrect": [list(cell) for cell in wrong_cells],
        "solved": False,
    }


@pytest.mark.parametrize(
    "board",
    [
        [],
        [[0] * 9 for _ in range(8)],
        [[0] * 9 for _ in range(8)] + [[0] * 8 + [10]],
        [[0] * 9 for _ in range(8)] + [[0] * 8 + [True]],
    ],
)
def test_check_route_rejects_invalid_boards(client, board):
    CURRENT["solution"] = make_solved_board()

    response = client.post("/check", json={"board": board})

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "Please submit a valid 9x9 Sudoku board."
    }


def test_check_route_requires_a_current_game(client):
    CURRENT["solution"] = None

    response = client.post("/check", json={"board": make_solved_board()})

    assert response.status_code == 400
    assert "No game in progress" in response.get_json()["error"]


def test_hint_route_returns_only_one_correct_empty_cell(client):
    solution = make_solved_board()
    puzzle = [row.copy() for row in solution]
    puzzle[0][0] = sudoku_logic.EMPTY
    puzzle[0][1] = sudoku_logic.EMPTY
    CURRENT["puzzle"] = puzzle
    CURRENT["solution"] = solution

    response = client.post("/hint", json={"board": puzzle})

    assert response.status_code == 200
    assert response.get_json() == {"row": 0, "col": 0, "value": solution[0][0]}


def test_hint_route_uses_submitted_board_to_find_empty_cell(client):
    solution = make_solved_board()
    puzzle = [row.copy() for row in solution]
    puzzle[0][0] = sudoku_logic.EMPTY
    CURRENT["puzzle"] = puzzle
    CURRENT["solution"] = solution

    board = [row.copy() for row in solution]
    board[0][1] = sudoku_logic.EMPTY

    response = client.post("/hint", json={"board": board})

    assert response.status_code == 200
    assert response.get_json() == {"row": 0, "col": 1, "value": solution[0][1]}


def test_hint_route_reports_no_empty_cells(client):
    solution = make_solved_board()
    CURRENT["puzzle"] = [row.copy() for row in solution]
    CURRENT["solution"] = solution

    response = client.post("/hint", json={"board": solution})

    assert response.status_code == 400
    assert response.get_json() == {"error": "There are no empty cells left to hint."}


def test_count_solutions_rejects_conflicting_board():
    board = sudoku_logic.create_empty_board()
    board[0][0] = 1
    board[0][1] = 1

    assert sudoku_logic.count_solutions(board) == 0
