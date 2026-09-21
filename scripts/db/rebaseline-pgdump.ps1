# Docker-free rebaseline: dump the LIVE public schema with pg_dump (no Docker,
# no WSL) and make it the single baseline. Verification of a clean rebuild is
# deferred to the CI `migrations` job (which runs Docker on the runner).
#
# Usage:
#   .\scripts\db\rebaseline-pgdump.ps1 -DbUrl "postgresql://postgres.bjevoybwufubtprkxbvb:PASSWORD@aws-0-<REGION>.pooler.supabase.com:5432/postgres"
#
# Get the connection string from the Supabase dashboard -> Project Settings ->
# Database -> Connection string -> "Session pooler", and put your real password
# in it (URL-encode special characters: @ -> %40).
#
# Safety: nothing is moved or overwritten unless pg_dump succeeds and produces a
# non-empty file.

param([Parameter(Mandatory = $true)][string]$DbUrl)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")   # repo root

$baseline = "supabase/migrations/00000000000000_baseline.sql"
$snapshot = "supabase/schema_snapshot.sql"
$archive  = "supabase/_archived_migrations"
$tmp      = "$snapshot.tmp"

# Locate pg_dump: PATH first, then the standard PostgreSQL install location.
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $cand = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
          Sort-Object FullName -Descending | Select-Object -First 1
  if ($cand) { $pgDump = $cand.FullName }
}
if (-not $pgDump) {
  throw "pg_dump not found. Install PostgreSQL (winget install PostgreSQL.PostgreSQL.17) or add its bin\ to PATH."
}
Write-Host "==> Using $pgDump"

if (Test-Path $tmp) { Remove-Item $tmp -Force }
Write-Host "==> Dumping the live public schema"
& $pgDump $DbUrl --schema=public --no-owner --schema-only -f $tmp
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE). Nothing was changed." }

if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1000) {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  throw "The dump is empty or truncated. Aborting without changes."
}

# pg_dump 17 wraps the dump in \restrict / \unrestrict psql meta-commands. Those
# are NOT SQL, so the migration runner (which applies via the SQL protocol, not
# psql) errors on the backslash. Strip just those wrapper lines.
Write-Host "==> Stripping psql \restrict/\unrestrict directives"
(Get-Content $tmp) | Where-Object { $_ -notmatch '^\\(restrict|unrestrict)\b' } |
  Set-Content $tmp -Encoding utf8

Write-Host "==> Archiving the old numbered migrations (kept in git history)"
New-Item -ItemType Directory -Force -Path $archive | Out-Null
Get-ChildItem "supabase/migrations" -File |
  Where-Object { $_.Name -match '^\d{4}_' } |
  ForEach-Object {
    git mv $_.FullName "$archive/" 2>$null
    if ($LASTEXITCODE -ne 0) { Move-Item $_.FullName "$archive/" -Force }
  }

Move-Item $tmp $snapshot -Force
Copy-Item $snapshot $baseline -Force

Write-Host ""
Write-Host "Done (Docker-free). Baseline written:"
Write-Host "  $baseline"
Write-Host "  $snapshot"
Write-Host "Commit and push; the CI 'migrations' job will verify it rebuilds cleanly."
