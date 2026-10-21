# infra/sauvegarde-pg.ps1
# Sauvegarde de la base tnr (pg_dump format custom) vers le NAS, avec rotation
#
#   powershell -NoProfile -File C:\Projects\qa-tnr-playwright\infra\sauvegarde-pg.ps1
#   powershell -NoProfile -File ...\sauvegarde-pg.ps1 -Destination D:\sauvegardes -Conserver 7
#
# Docker dans WSL (cas du poste de recette) : les commandes passent par « wsl -d <Distribution> -u root docker … ».
# Docker natif sous Windows (Docker Desktop, serveur) : détecté automatiquement, WSL n'est pas utilisé.
#
# Le dump est produit DANS le conteneur, copié dans le dossier temporaire Windows, puis sur la destination :
#   - une redirection PowerShell de la sortie de pg_dump corromprait le binaire ;
#   - docker cp exécuté dans WSL ne sait pas écrire sur un chemin UNC (\\Pronas01\…).
#
# Destination par défaut HORS du dossier playwright : ce dossier est servi en HTTP par le service « rapports ».
#
# Restauration (base vide ou --clean) :
#   wsl -d Ubuntu -u root docker cp /mnt/c/chemin/tnr-AAAAMMJJ-HHMMSS.dump tnr-postgres:/tmp/restaure.dump
#   wsl -d Ubuntu -u root docker exec tnr-postgres pg_restore -U postgres -d tnr --clean --if-exists /tmp/restaure.dump

param(
  [string]$Destination  = '\\Pronas01\Dsi\ACT\Recettes-Qualification\QTP TNR\sauvegardes-pg',
  [int]$Conserver       = 14,          # nombre de dumps gardés
  [string]$Distribution = 'Ubuntu',    # distribution WSL qui fait tourner Docker
  [string]$Conteneur    = 'tnr-postgres'
)

$ErrorActionPreference = 'Stop'

# Docker natif si disponible, sinon Docker dans WSL (en root : pas de mot de passe sudo, pas de groupe docker requis)
$dockerNatif = [bool](Get-Command docker.exe -ErrorAction SilentlyContinue)
function Invoke-Docker {
  if ($dockerNatif) { & docker.exe @args } else { & wsl.exe -d $Distribution -u root -- docker @args }
  if ($LASTEXITCODE -ne 0) { throw "docker $($args[0]) en échec (code $LASTEXITCODE)" }
}

$nom   = "tnr-$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
$local = Join-Path $env:TEMP $nom

try {
  Invoke-Docker exec $Conteneur pg_dump -U postgres -d tnr -Fc -f "/tmp/$nom"

  # Copie conteneur → dossier temporaire Windows (vu depuis WSL sous /mnt/c/…)
  $cible = if ($dockerNatif) { $local } else { (& wsl.exe -d $Distribution -- wslpath -a ($local -replace '\\', '/')).Trim() }
  Invoke-Docker cp "${Conteneur}:/tmp/$nom" $cible
  Invoke-Docker exec $Conteneur rm -f "/tmp/$nom"

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Copy-Item $local (Join-Path $Destination $nom)
  $taille = [math]::Round((Get-Item $local).Length / 1KB)
} finally {
  Remove-Item $local -ErrorAction SilentlyContinue
}

# Rotation : on garde les $Conserver dumps les plus récents
Get-ChildItem $Destination -Filter 'tnr-*.dump' | Sort-Object Name -Descending |
  Select-Object -Skip $Conserver | Remove-Item -Confirm:$false

Write-Output "[sauvegarde-pg] $nom ($taille Ko) → $Destination"
