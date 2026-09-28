# Phase 2: finish the lib/ -> server/ split  (run from E:\FarmersFresh)
# Claude already wrote the new src/server/* files and updated every import.
# This removes the old copies, installs the server-only marker, and verifies.
$ErrorActionPreference = "Stop"

# 1. Remove the old server modules from src/lib (new copies live in src/server)
#    events.ts is deleted outright: logEvent() was never called — the DB functions log events.
$old = "analytics","auth","banners","catalogue","credit","deliveries","events","forecast",
       "orders","overview","pos","settings","shop","stock" | ForEach-Object { "src/lib/$_.ts" }
$old += "src/lib/supabase/server.ts", "src/lib/supabase/proxy.ts"
git rm -q -- $old

# 2. Official marker package (free, 0 dependencies): build fails if client code imports src/server
npm install server-only; if ($LASTEXITCODE) { throw "npm install failed" }

# 3. Empty leftovers from the Docker attempt
Remove-Item -Force backup_schema.sql, backup_data.sql -ErrorAction SilentlyContinue

# 4. Verify (stops on the first failure)
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run typecheck;     if ($LASTEXITCODE) { throw "typecheck failed" }
npm run lint;          if ($LASTEXITCODE) { throw "lint failed" }
npm run ci:boundaries; if ($LASTEXITCODE) { throw "boundaries failed" }
npm test;              if ($LASTEXITCODE) { throw "tests failed" }
npm run build;         if ($LASTEXITCODE) { throw "build failed" }

Write-Host "`nPhase 2 OK. Commit with:" -ForegroundColor Green
Write-Host 'Remove-Item scripts\phase2-finish.ps1, scripts\phase1-move-to-src.ps1 -ErrorAction SilentlyContinue; git add -A; git commit -m "refactor: split src/lib into src/server (backend) and src/lib (shared) with server-only guard (phase 2)"'
