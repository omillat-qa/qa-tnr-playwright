# infra/sauvegarde-pg.ps1
# Sauvegarde de la base tnr (pg_dump format custom) vers le NAS — à planifier chaque nuit sur devqtp04
#
#   powershell -File C:\Projects\qa-tnr-playwright\infra\sauvegarde-pg.ps1
#   Restauration : docker exec -i tnr-postgres pg_restore -U postgres -d tnr --clean --if-exists < fichier.dump
#                  (ou copier le fichier dans le conteneur avec docker cp puis pg_restore -f)
#
# Le dump est produit DANS le conteneur puis copié (une redirection PowerShell corromprait le binaire).

param(
  [string]$Destination = '\\Pronas01\Dsi\ACT\Recettes-Qualification\QTP TNR\playwright\sauvegardes-pg',
  [int]$Conserver = 14   # nombre de dumps gardés
)

$ErrorActionPreference = 'Stop'
$nom = "tnr-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
docker exec tnr-postgres pg_dump -U postgres -d tnr -Fc -f "/tmp/$nom"
if ($LASTEXITCODE -ne 0) { throw "pg_dump en échec ($LASTEXITCODE)" }
docker cp "tnr-postgres:/tmp/$nom" (Join-Path $Destination $nom)
if ($LASTEXITCODE -ne 0) { throw "docker cp en échec ($LASTEXITCODE)" }
docker exec tnr-postgres rm -f "/tmp/$nom" | Out-Null

Get-ChildItem $Destination -Filter 'tnr-*.dump' | Sort-Object Name -Descending |
  Select-Object -Skip $Conserver | Remove-Item -Confirm:$false

Write-Output "[sauvegarde-pg] $nom → $Destination"
