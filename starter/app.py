from flask import Flask, jsonify, render_template, request

import sudoku_logic

app = Flask(__name__)

CURRENT = {
    "puzzle": None,
    "solution": None,
}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/new')
def new_game():
    difficulty = request.args.get('difficulty', 'easy')
    if difficulty not in sudoku_logic.DIFFICULTY_CLUES:
        choices = ', '.join(sudoku_logic.DIFFICULTY_CLUES)
        return jsonify({'error': f'Invalid difficulty. Choose {choices}.'}), 400

    puzzle, solution = sudoku_logic.generate_puzzle(difficulty)
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    return jsonify({'puzzle': puzzle})


def _get_submitted_board():
    """Return a valid board from the request, or None for invalid input."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None

    board = data.get("board")
    if not isinstance(board, list) or len(board) != sudoku_logic.SIZE:
        return None
    for row in board:
        if not isinstance(row, list) or len(row) != sudoku_logic.SIZE:
            return None
        if any(
            isinstance(value, bool)
            or not isinstance(value, int)
            or value < sudoku_logic.EMPTY
            or value > sudoku_logic.SIZE
            for value in row
        ):
            return None
    return board


@app.route('/check', methods=['POST'])
def check_solution():
    solution = CURRENT.get('solution')
    if solution is None:
        return jsonify({"error": "No game in progress. Start a new game first."}), 400

    board = _get_submitted_board()
    if board is None:
        return jsonify({"error": "Please submit a valid 9x9 Sudoku board."}), 400

    incorrect = []
    for i in range(sudoku_logic.SIZE):
        for j in range(sudoku_logic.SIZE):
            if board[i][j] != sudoku_logic.EMPTY and board[i][j] != solution[i][j]:
                incorrect.append([i, j])

    solved = all(
        board[row][col] == solution[row][col]
        for row in range(sudoku_logic.SIZE)
        for col in range(sudoku_logic.SIZE)
    )
    return jsonify({"incorrect": incorrect, "solved": solved})


@app.route('/hint', methods=['POST'])
def get_hint():
    if CURRENT.get("solution") is None or CURRENT.get("puzzle") is None:
        return jsonify({"error": "No game in progress. Start a new game first."}), 400

    board = _get_submitted_board()
    if board is None:
        return jsonify({"error": "Please submit a valid 9x9 Sudoku board."}), 400

    for row in range(sudoku_logic.SIZE):
        for col in range(sudoku_logic.SIZE):
            if (
                CURRENT["puzzle"][row][col] == sudoku_logic.EMPTY
                and board[row][col] == sudoku_logic.EMPTY
            ):
                return jsonify(
                    {
                        "row": row,
                        "col": col,
                        "value": CURRENT["solution"][row][col],
                    }
                )

    return jsonify({"error": "There are no empty cells left to hint."}), 400


if __name__ == '__main__':
    app.run(debug=True)