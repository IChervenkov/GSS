$ErrorActionPreference = 'Stop'

function ConvertTo-PlainText([Security.SecureString]$Value) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

$env:GSS_KEYSTORE_PATH = Read-Host 'Keystore path'
$env:GSS_KEY_ALIAS = Read-Host 'Keystore key alias'
$env:GSS_STORE_PASSWORD = ConvertTo-PlainText (Read-Host 'Keystore password' -AsSecureString)
$keyPassword = ConvertTo-PlainText (Read-Host 'Key password (press Enter if it is the same)' -AsSecureString)
$env:GSS_KEY_PASSWORD = if ([string]::IsNullOrEmpty($keyPassword)) { $env:GSS_STORE_PASSWORD } else { $keyPassword }

try {
    flutter build apk --release
    if ($LASTEXITCODE -ne 0) { throw "Flutter release build failed with exit code $LASTEXITCODE." }
    $apk = Get-Item 'build\app\outputs\flutter-apk\app-release.apk'
    $appVersion = (Select-String -LiteralPath 'pubspec.yaml' -Pattern '^version:\s*([^+\s]+)' | Select-Object -First 1).Matches[0].Groups[1].Value
    if ([string]::IsNullOrWhiteSpace($appVersion)) { throw 'Unable to determine the app version from pubspec.yaml.' }
    $releaseApk = Join-Path $apk.DirectoryName ("gss-asset-{0}-release.apk" -f $appVersion)
    Copy-Item -LiteralPath $apk.FullName -Destination $releaseApk -Force
    $releaseApk = Get-Item -LiteralPath $releaseApk
    $sha256 = (Get-FileHash -LiteralPath $releaseApk.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Output ''
    Write-Output 'FullName'
    Write-Output '--------'
    Write-Output $releaseApk.FullName
    Write-Output ''
    Write-Output 'SHA-256 hash'
    Write-Output '--------'
    Write-Output $sha256
}
finally {
    Remove-Item Env:GSS_KEYSTORE_PATH, Env:GSS_KEY_ALIAS, Env:GSS_STORE_PASSWORD, Env:GSS_KEY_PASSWORD -ErrorAction SilentlyContinue
}
