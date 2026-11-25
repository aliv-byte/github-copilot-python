import pytest

import sudoku_logic


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


def test_count_solutions_rejects_conflicting_board():
    board = sudoku_logic.create_empty_board()
    board[0][0] = 1
    board[0][1] = 1

    assert sudoku_logic.count_solutions(board) == 0
