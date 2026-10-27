param([switch]$InstallPackages)
$ErrorActionPreference = 'Stop'
$started = Get-Date
$root = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content (Join-Path $root 'build-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.schema -ne 1 -or $manifest.node.sha256 -notmatch '^[a-f0-9]{64}$' -or $manifest.node.url -notmatch '^https://nodejs\.org/dist/v[0-9.]+/node-v[0-9.]+-win-x64\.zip$') { throw 'Invalid pinned Node build manifest.' }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'Spark Foundry requires Windows x64.' }
$tools = Join-Path $root '.tools'
$local = Join-Path $root $manifest.node.target
if ([IO.Path]::GetFullPath($local) -ne [IO.Path]::GetFullPath((Join-Path $tools 'node'))) { throw 'Unexpected Node target path.' }
New-Item -ItemType Directory -Force $tools | Out-Null
$lock = $null
$stage = Join-Path $tools ('node-stage-' + [guid]::NewGuid().ToString('N'))
$journal = Join-Path $tools 'node-activation.json'
function Get-TreeManifest([string]$directory) {
  if (!(Test-Path $directory -PathType Container)) { throw "Missing tree: $directory" }
  if ((Get-Item $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point at dependency root.' }
  $entries = @(Get-ChildItem $directory -Recurse -Force)
  if (@($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Reparse point in dependency tree.' }
  $result = @{}
  foreach ($entry in $entries) { if (!$entry.PSIsContainer) { $relative = $entry.FullName.Substring($directory.Length).TrimStart('\', '/'); $result[$relative] = (Get-FileHash $entry.FullName -Algorithm SHA256).Hash } }
  return $result
}
function Test-Tree([string]$directory, $expected) {
  try { $actual = Get-TreeManifest $directory; if ($actual.Count -ne $expected.Count) { return $false }; foreach ($key in $expected.Keys) { if ($actual[$key] -ne $expected[$key]) { return $false } }; return $true } catch { return $false }
}
function Write-Journal([string]$destination, [string]$text) {
  $temporary = $destination + '.' + [guid]::NewGuid().ToString('N') + '.new'
  $bytes = [Text.Encoding]::UTF8.GetBytes($text)
  $stream = [IO.File]::Open($temporary, 'CreateNew', 'Write', 'None')
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
  Move-Item $temporary $destination
}
function Quarantine([string]$location) { if (Test-Path $location) { Move-Item $location ($location + '.quarantine-' + [guid]::NewGuid().ToString('N')) } }
try {
  # The lock covers activation and project dependency installation, not unrelated toolchains.
  $deadline = (Get-Date).AddMinutes(10)
  while (!$lock) {
    try { $lock = [IO.File]::Open((Join-Path $tools 'dependency.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch [IO.IOException] { if ((Get-Date) -gt $deadline) { throw 'Another dependency operation still holds the project lock after ten minutes.' }; Start-Sleep -Seconds 1 }
  }
  $archive = Join-Path $tools ($manifest.node.archiveRoot + '.zip')
  if (!(Test-Path $archive) -or (Get-FileHash $archive -Algorithm SHA256).Hash -ne $manifest.node.sha256) {
    $download = $archive + '.' + [guid]::NewGuid().ToString('N') + '.partial'
    Write-Host "Downloading Node $($manifest.node.version) from $($manifest.node.url)"
    try {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest $manifest.node.url -OutFile $download -UseBasicParsing -TimeoutSec 300
      if ((Get-FileHash $download -Algorithm SHA256).Hash -ne $manifest.node.sha256) { throw 'Downloaded Node archive SHA-256 does not match the committed manifest.' }
      if (Test-Path $archive) { Quarantine $archive }; Move-Item $download $archive
    } finally { if (Test-Path $download) { Remove-Item $download -Force } }
  }
  Write-Host 'Verifying the complete Node tree against the pinned archive.'
  Expand-Archive $archive $stage
  $candidate = Join-Path $stage $manifest.node.archiveRoot
  $expected = Get-TreeManifest $candidate
  foreach ($file in @('node.exe', 'npm.cmd', 'node_modules\npm\bin\npm-cli.js')) { if (!$expected.ContainsKey($file)) { throw "Incomplete Node archive: missing $file" } }
  $activeValid = Test-Tree $local $expected
  # A malformed journal is not trusted: independently verify active and backups first.
  if (Test-Path $journal) {
    if ($activeValid) { Quarantine $journal }
    else {
      $backup = Get-ChildItem $tools -Directory -Filter 'node-backup-*' | Where-Object { Test-Tree $_.FullName $expected } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if (!$backup) { throw 'Interrupted Node activation has no independently verified active tree or backup. Journal retained; recovery requires inspection.' }
      Quarantine $local; Move-Item $backup.FullName $local; Quarantine $journal; $activeValid = $true
      Write-Host 'Recovered the verified previous Node tree.'
    }
  }
  if (!$activeValid) {
    $backupPath = Join-Path $tools ('node-backup-' + [guid]::NewGuid().ToString('N'))
    $record = @{ schema = 1; active = $local; backup = $backupPath; stage = $candidate; archiveSha256 = $manifest.node.sha256 } | ConvertTo-Json
    Write-Journal $journal $record
    try {
      if (Test-Path $local) { Move-Item $local $backupPath }
      Move-Item $candidate $local
      if (!(Test-Tree $local $expected)) { throw 'Activated Node tree verification failed.' }
      if ((& "$local\node.exe" --version) -ne "v$($manifest.node.version)") { throw 'Activated Node version is incorrect.' }
      Remove-Item $journal -Force
    } catch {
      if (Test-Tree $backupPath $expected) { Quarantine $local; Move-Item $backupPath $local }
      throw
    }
    Write-Host "Activated verified Node $($manifest.node.version) at $local"
  } else { Write-Host "Reusing fully verified Node $($manifest.node.version) at $local" }
  $gitLocal = Join-Path $tools 'git'
  $gitArchive = Join-Path $tools 'mingit.zip'
  $gitStage = Join-Path $tools ('git-stage-' + [guid]::NewGuid().ToString('N'))
  $gitJournal = Join-Path $tools 'git-activation.json'
  if ($manifest.git.sha256 -notmatch '^[a-f0-9]{64}$' -or $manifest.git.url -notmatch '^https://github\.com/git-for-windows/git/releases/download/v[0-9.]+windows\.[0-9]+/MinGit-[0-9.]+-64-bit\.zip$') { throw 'Invalid pinned MinGit manifest.' }
  try {
    if (!(Test-Path $gitArchive) -or (Get-FileHash $gitArchive -Algorithm SHA256).Hash -ne $manifest.git.sha256) {
      $partial = $gitArchive + '.' + [guid]::NewGuid().ToString('N') + '.partial'
      Write-Host "Downloading MinGit $($manifest.git.version) from $($manifest.git.url)"
      try {
        Invoke-WebRequest $manifest.git.url -OutFile $partial -UseBasicParsing -TimeoutSec 300
        if ((Get-FileHash $partial -Algorithm SHA256).Hash -ne $manifest.git.sha256) { throw 'MinGit archive SHA-256 mismatch.' }
        if (Test-Path $gitArchive) { Quarantine $gitArchive }; Move-Item $partial $gitArchive
      } finally { if (Test-Path $partial) { Remove-Item $partial -Force } }
    }
    Expand-Archive $gitArchive $gitStage
    $gitExpected = Get-TreeManifest $gitStage
    if (!$gitExpected.ContainsKey('cmd\git.exe')) { throw 'Incomplete MinGit archive: cmd/git.exe missing.' }
    $gitValid = Test-Tree $gitLocal $gitExpected
    if (Test-Path $gitJournal) {
      if ($gitValid) { Quarantine $gitJournal }
      else {
        $gitBackup = Get-ChildItem $tools -Directory -Filter 'git-backup-*' | Where-Object { Test-Tree $_.FullName $gitExpected } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (!$gitBackup) { throw 'Interrupted MinGit activation has no verified active tree or backup; journal retained.' }
        Quarantine $gitLocal; Move-Item $gitBackup.FullName $gitLocal; Quarantine $gitJournal; $gitValid = $true
      }
    }
    if (!$gitValid) {
      $gitBackupPath = Join-Path $tools ('git-backup-' + [guid]::NewGuid().ToString('N'))
      $gitRecord = @{ schema = 1; active = $gitLocal; backup = $gitBackupPath; stage = $gitStage; archiveSha256 = $manifest.git.sha256 } | ConvertTo-Json
      Write-Journal $gitJournal $gitRecord
      try {
        if (Test-Path $gitLocal) { Move-Item $gitLocal $gitBackupPath }; Move-Item $gitStage $gitLocal
        if (!(Test-Tree $gitLocal $gitExpected)) { throw 'Activated MinGit tree verification failed.' }
        if ((& "$gitLocal\cmd\git.exe" --version) -ne "git version $($manifest.git.version)") { throw 'Activated MinGit version mismatch.' }
        Remove-Item $gitJournal -Force
      } catch { if (Test-Tree $gitBackupPath $gitExpected) { Quarantine $gitLocal; Move-Item $gitBackupPath $gitLocal }; throw }
      Write-Host "Activated verified MinGit $($manifest.git.version) at $gitLocal"
    } else { Write-Host "Reusing fully verified MinGit $($manifest.git.version) at $gitLocal" }
  } catch { throw "MinGit $($manifest.git.version), source $($manifest.git.url), target $gitLocal. $($_.Exception.Message)" }
  finally { if (Test-Path $gitStage) { Remove-Item $gitStage -Recurse -Force } }
  $env:PATH = "$local;$gitLocal\cmd;$env:PATH"
  if ($InstallPackages) {
    Write-Host 'Installing project dependencies from package-lock.json using npm integrity checks.'
    $electronArchive = Join-Path $tools 'electron-win-x64.zip'
    if ($manifest.electron.sha256 -notmatch '^[a-f0-9]{64}$' -or $manifest.electron.url -notmatch '^https://github\.com/electron/electron/releases/download/v[0-9.]+/electron-v[0-9.]+-win32-x64\.zip$') { throw 'Invalid pinned Electron manifest.' }
    if (!(Test-Path $electronArchive) -or (Get-FileHash $electronArchive -Algorithm SHA256).Hash -ne $manifest.electron.sha256) {
      $partial = $electronArchive + '.' + [guid]::NewGuid().ToString('N') + '.partial'
      Write-Host "Downloading Electron $($manifest.electron.version) from $($manifest.electron.url)"
      try {
        Invoke-WebRequest $manifest.electron.url -OutFile $partial -UseBasicParsing -TimeoutSec 600
        if ((Get-FileHash $partial -Algorithm SHA256).Hash -ne $manifest.electron.sha256) { throw 'Electron archive SHA-256 mismatch.' }
        if (Test-Path $electronArchive) { Quarantine $electronArchive }; Move-Item $partial $electronArchive
      } finally { if (Test-Path $partial) { Remove-Item $partial -Force } }
    }
    Push-Location $root
    $oldSkip = $env:ELECTRON_SKIP_BINARY_DOWNLOAD
    try {
      $env:ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
      & "$local\npm.cmd" ci --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit $LASTEXITCODE; source https://registry.npmjs.org, required versions in package-lock.json." }
      $electronTarget = Join-Path $root 'node_modules\electron\dist'
      Expand-Archive $electronArchive $electronTarget
      if (!(Test-Path "$electronTarget\electron.exe") -or !(Test-Path "$electronTarget\resources")) { throw 'Pinned Electron archive is incomplete.' }
      [IO.File]::WriteAllText((Join-Path $root 'node_modules\electron\path.txt'), 'electron.exe')
    }
    finally { $env:ELECTRON_SKIP_BINARY_DOWNLOAD = $oldSkip; Pop-Location }
  }
  Write-Host ('Dependency preparation completed in {0:N1} seconds.' -f ((Get-Date) - $started).TotalSeconds)
} catch {
  Write-Error "Dependency preparation incomplete. Node $($manifest.node.version), source $($manifest.node.url), target $local. $($_.Exception.Message)"
  throw
} finally {
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  if ($lock) { $lock.Dispose() }
}
