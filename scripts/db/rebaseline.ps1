# Squash the migration history to a single baseline generated from the LIVE
# database. Run once, from the repo root, in PowerShell, with the Supabase CLI
# linked to the production project and Docker Desktop RUNNING.
#
# Safety: nothing destructive happens unless the dump actually succeeds and
# produces a non-empty file. A failed dump (e.g. Docker not started) aborts
# before any migration is touched.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")   # repo root

$baseline = "supabase/migrations/00000000000000_baseline.sql"
$snapshot = "supabase/schema_snapshot.sql"
$archive  = "supabase/_archived_migrations"

function Invoke-Native {
  param([string]$Exe, [string[]]$Args)
  & $Exe @Args
  if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Args -join ' ')' failed (exit $LASTEXITCODE)." }
}

# 0) Fail fast if Docker isn't up — the CLI needs it for both dump and reset.
Write-Host "==> Checking Docker is running"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop isn't running. Start it (and wait for 'Engine running'), then re-run."
}

# 1) Dump the live schema to a TEMP file first, so a failure can't clobber the
#    existing snapshot.
$tmp = "$snapshot.tmp"
if (Test-Path $tmp) { Remove-Item $tmp -Force }
Write-Host "==> Dumping the live schema from the linked project"
Invoke-Native "supabase" @("db","dump","-f",$tmp)

if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1000) {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  throw "The dump produced an empty or truncated file. Aborting without changing anything."
}

# pg_dump 17 wraps the dump in \restrict / \unrestrict psql meta-commands, which
# the SQL migration runner can't parse. Strip just those wrapper lines.
(Get-Content $tmp) | Where-Object { $_ -notmatch '^\\(restrict|unrestrict)\b' } |
  Set-Content $tmp -Encoding utf8

# 2) Dump is good — now it is safe to move things.
Write-Host "==> Archiving the old numbered migrations (kept in git history)"
New-Item -ItemType Directory -Force -Path $archive | Out-Null
Get-ChildItem "supabase/migrations" -File |
  Where-Object { $_.Name -match '^\d' } |
  ForEach-Object {
    git mv $_.FullName "$archive/" 2>$null
    if ($LASTEXITCODE -ne 0) { Move-Item $_.FullName "$archive/" -Force }
  }

Move-Item $tmp $snapshot -Force
Copy-Item $snapshot $baseline -Force

# 3) Verify a fresh database builds from the baseline alone.
Write-Host "==> Verifying the baseline rebuilds a fresh database cleanly"
Invoke-Native "supabase" @("db","reset")

Write-Host ""
Write-Host "Done. A fresh database now builds from a single baseline:"
Write-Host "  $baseline"
Write-Host "  $snapshot (same content; used by the CI recovery path)"
