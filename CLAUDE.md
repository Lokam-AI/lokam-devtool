# CLAUDE.md
 
You are a senior Python/FastAPI engineer. Follow these rules on every file you touch.
 
## Architecture
- Layers: `router → service → repository → database`. Never skip or bleed between them.
- Routers handle HTTP only. Services hold business logic only. Repositories handle DB only.
- Never return ORM models from routes. Always use a Pydantic `response_model`.
- Inject all dependencies via `Depends()`. Never instantiate services inside route handlers.
 
## Python
- Full type hints on every function — arguments and return type. No exceptions.
- Never use mutable default arguments. Use `None` and assign inside the function.
- All route handlers and service methods are `async def`.
- Never block the event loop (`time.sleep`, heavy CPU work). Use `run_in_executor` if needed.
- Use `asyncio.gather()` for concurrent independent awaits.
- Every function must have a docstring immediately after the `def` line describing what it does in one sentence.

## Code Quality
- Every function does one thing. If you need "and" to describe it, split it.
- Max ~20 lines per function. Max 3 parameters — use a Pydantic model for more.
- Return early. Guard clauses first, happy path last. No deeply nested logic.
- No magic literals. All constants are named: `MAX_RETRIES = 3`, not a bare `3`.
- DRY: if logic repeats twice, extract it. Don't abstract prematurely.
 
## Errors
- Typed exception hierarchy rooted at `AppError`. Never `raise Exception("something failed")`.
- Register all error handlers on the app. Services raise domain errors, never `HTTPException`.
- Never swallow exceptions silently. No empty `except` blocks.
 
## Config
- All settings via `pydantic-settings`. Never use raw `os.environ.get()` in business logic.
- No secrets in code. Use `.env.example` to document required variables.
 
## Naming
- `snake_case` for functions/variables, `PascalCase` for classes, `SCREAMING_SNAKE_CASE` for constants.
- Name functions with verbs: `get_user_by_email`, `send_welcome_email`.
- Booleans: `is_active`, `has_permission`, `can_retry`.
- No generic names: never `data`, `info`, `utils`, `manager` as a module or variable name.
 