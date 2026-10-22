# scripts/campagne-quotidienne.ps1
# Campagne TNR planifiée (tâche Windows) : tests Playwright puis email du rapport
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Projects\qa-tnr-playwright\scripts\campagne-quotidienne.ps1 -Campagne tnr-compliance-ua
#
# Campagnes : tnr-compliance-ua | perf-compliance-ua | perf-ellipro-ua (table $campagnes ci-dessous)
#
# Sorties : comme un run manuel (TNR_SORTIES de .env.local → NAS\<machine>\test-output), importées par la tâche
# « TNR import PostgreSQL » du poste qui héberge PostgreSQL.
# Journal local : %LOCALAPPDATA%\qa-tnr\campagne-<campagne>.log (horodaté, un bloc par passage)
#
# Pas de --reporter en ligne de commande : il désactiverait tnr-reporter (run perdu pour Grafana).

param(
  [Parameter(Mandatory)]
  [ValidateSet('tnr-compliance-ua', 'perf-compliance-ua', 'perf-ellipro-ua')]
  [string]$Campagne
)

$ErrorActionPreference = 'Stop'

# app/env pour le mailer + projets lancés — les setups suivent via les dépendances déclarées dans apps.matrix.js
$campagnes = @{
  'tnr-compliance-ua' = @{
    App = 'compliance-v2'; Env = 'ua'
    Projets = @(
      'tnr-chromium-ua-compliance-v2'
      'tnr-chromium-ua-admin-compliance-v2'
      'tnr-chromium-ua-collab-compliance-v2'
      'tnr-chromium-ua-referent-compliance-v2'
      'tnr-chromium-ua-noparam-compliance-v2'
      'tnr-chromium-ua-admin-taches-compliance-v2'
    )
  }
  'perf-compliance-ua' = @{ App = 'compliance-v2'; Env = 'ua'; Projets = @('perf-recherche-ua-compliance-v2') }
  'perf-ellipro-ua'    = @{ App = 'ellipro-risk';  Env = 'ua'; Projets = @('perf-recherche-ua-ellipro-risk') }
}

$c       = $campagnes[$Campagne]
$App     = $c.App
$Env     = $c.Env
$projets = $c.Projets

$racine  = Split-Path $PSScriptRoot -Parent
$dossLog = Join-Path $env:LOCALAPPDATA 'qa-tnr'
New-Item -ItemType Directory -Force -Path $dossLog | Out-Null
$journal = Join-Path $dossLog "campagne-$Campagne.log"

function Write-Journal([string]$texte) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $texte" | Add-Content -Path $journal -Encoding utf8
}

Set-Location $racine
Write-Journal "=== Début campagne $Campagne ($App/$Env) sur $env:COMPUTERNAME"

# Tests : la sortie de Playwright va dans le journal ; le code retour (≠ 0 si échecs) n'empêche pas l'email
$argsPw = @('playwright', 'test', '--config=config/playwright.config.js') + ($projets | ForEach-Object { "--project=$_" })
& npx.cmd @argsPw *>&1 | Add-Content -Path $journal -Encoding utf8
$codeTests = $LASTEXITCODE
Write-Journal "Tests terminés (code $codeTests)"

& node.exe shared/mailer/send-report.js "--app=$App" "--env=$Env" *>&1 | Add-Content -Path $journal -Encoding utf8
$codeMail = $LASTEXITCODE
Write-Journal "Email terminé (code $codeMail)"
Write-Journal "=== Fin campagne $Campagne"

# Code retour de la tâche planifiée : échec si l'email n'est pas parti, sinon celui des tests
if ($codeMail -ne 0) { exit $codeMail }
exit $codeTests
