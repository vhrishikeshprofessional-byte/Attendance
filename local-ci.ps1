$ErrorActionPreference = "Stop"
 
function Run-Command {
    param([scriptblock]$Command)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Command failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "        LOCAL CI SCRIPT                   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# ------------------------------------------
# BACKEND
# ------------------------------------------
Write-Host "`n>>> Running Backend Checks..." -ForegroundColor Yellow

Set-Location attendance-backend

Write-Host "-> Installing Backend Dependencies..."
Run-Command { .venv\Scripts\pip install -r requirements-dev.txt }
Run-Command { .venv\Scripts\pip install pip-audit }

Write-Host "-> Ruff Check"
Run-Command { .venv\Scripts\python -m ruff check . }

Write-Host "-> MyPy Check (Skipping locally: AppLocker blocks mypyc DLLs on Windows)"
# Run-Command { .venv\Scripts\python -m mypy app }

Write-Host "-> Bandit SAST Scan"
Run-Command { .venv\Scripts\python -m bandit -r app -s B105 -f json -o bandit.json }

Write-Host "-> pip-audit (Dependency Scan)"
Run-Command { .venv\Scripts\python -m pip_audit -r requirements.txt --strict }

Write-Host "-> Pytest (with coverage >= 80%)"
Run-Command { .venv\Scripts\python -m pytest --cov=app --cov-branch --cov-report=term-missing --cov-report=xml --cov-fail-under=80 -v }

Set-Location ..

# ------------------------------------------
# FRONTEND
# ------------------------------------------
Write-Host "`n>>> Running Frontend Checks..." -ForegroundColor Yellow

Set-Location attendance-frontend

Write-Host "-> Installing Frontend Dependencies..."
Run-Command { npm install }

Write-Host "-> npm typecheck"
Run-Command { npm run typecheck }

Write-Host "-> npm audit"
Run-Command { npm audit --audit-level=high }

Write-Host "-> vitest (with coverage)"
Run-Command { npx vitest run --coverage }

Write-Host "-> npm run build"
Run-Command { npm run build }

Set-Location ..

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host " All local CI checks passed successfully! " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
