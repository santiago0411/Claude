# lean-kit installer for Windows. Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1 [--dry-run] [--codex] [--statusline] [--uninstall]
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js 18 or newer is required: https://nodejs.org'
    exit 1
}
node "$PSScriptRoot\install.mjs" @args
exit $LASTEXITCODE
