# Copilot Instructions: Sudoku Flask Refactor

## Project goal
Refactor the legacy Flask Sudoku game in `starter/` into a modern, modular app with
difficulty levels, a timer, live feedback, Hint/Check buttons, and a Top 10 scoreboard.

## Tech stack
- Python 3.12 and Flask for the backend
- Vanilla JavaScript (ES6+ modules) and plain CSS for the frontend
- pytest for tests

## Code style
- Follow PEP 8 for Python; use type hints and short docstrings.
- Use clear, descriptive names for functions and variables.
- Keep functions small and single-purpose.
- Add comments that explain why, not what.
- In JavaScript, use `const`/`let`, arrow functions, and event delegation.

## Structure
- Separate puzzle generation, solving, and validation from the Flask routes.
- Use Flask blueprints or modules where it makes sense.
- Keep HTML templates, CSS, and JS in separate files.

## Game rules and logic
- Every generated puzzle must have exactly one unique solution.
- Difficulty (Easy, Medium, Hard) changes how many cells are prefilled.
- Prefilled cells and hinted cells are locked and cannot be edited.
- Invalid moves get immediate visual feedback.
- Show a completion message with time and hints used when solved.

## UI and accessibility
- Support light and dark mode, with text and controls readable in both.
- Use alternating colors for the 3x3 squares with no layout shift.
- Make the layout responsive from mobile to desktop.
- Use semantic HTML, labels, keyboard support and sufficient contrast (WCAG 2.1 AA).

## Data
- Save the Top 10 (name, time, difficulty, hints) in `localStorage`.

## Error handling
- Validate all inputs and return clear error messages.
- Never fail silently; show friendly messages to the user.

## Testing
- Run `pytest` after every refactor or feature change.
- Do not break existing tests; fix failures before moving on.

## Working style
- Make small, focused changes and explain them.
- Ask before deleting or renaming files.