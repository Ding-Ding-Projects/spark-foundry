$ErrorActionPreference = 'Stop'
# Release-tool bootstrap is deliberately fail-closed until a reviewed canonical pin exists.
$manifest = Join-Path $PSScriptRoot 'release-tools.json'
if (!(Test-Path $manifest)) { throw 'Missing reviewed GitHub CLI archive pin: scripts/release-tools.json. No release was published.' }
$spec = (Get-Content $manifest -Raw | ConvertFrom-Json).gh
if ($spec.url -notmatch '^https://github.com/cli/cli/releases/download/v[0-9.]+/gh_[0-9.]+_windows_amd64.zip$' -or $spec.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid GitHub CLI canonical pin.' }
$root = Split-Path $PSScriptRoot -Parent
$target = Join-Path $root '.tools\gh'
$archive = Join-Path $root '.tools\gh.zip'
if (!(Test-Path $archive) -or (Get-FileHash $archive -Algorithm SHA256).Hash -ne $spec.sha256) { Invoke-WebRequest $spec.url -OutFile $archive -UseBasicParsing }
if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $spec.sha256) { throw 'GitHub CLI download checksum mismatch.' }
$stage = Join-Path $root ('.tools\gh-stage-' + [guid]::NewGuid().ToString('N'))
Expand-Archive $archive $stage
$binary = Get-ChildItem $stage -Filter gh.exe -Recurse -File
if (@($binary).Count -ne 1) { throw 'GitHub CLI archive has an unexpected layout.' }
if ((& $binary.FullName --version | Select-Object -First 1) -notlike "gh version $($spec.version) *") { throw 'GitHub CLI version verification failed.' }
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Move-Item $stage $target
$binary = Get-ChildItem $target -Filter gh.exe -Recurse -File
$binary.DirectoryName | Out-File -FilePath $env:GITHUB_PATH -Append -Encoding utf8
Write-Host "Verified project-local GitHub CLI $($spec.version)."
