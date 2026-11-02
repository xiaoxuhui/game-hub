# A process crash leaves the file behind, intentionally blocking further writes
# until the operator has inspected the release state and removed the stale lock.
function Enter-ResourcePublicationLock([string]$Path='D:\aiden\game-hub-resource-publication.lock') {
    try { $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read) } catch { throw "Publication lock is held or stale: $Path" }
    try {
        $text="pid=$PID`nstartedUtc=$([DateTime]::UtcNow.ToString('o'))`n"
        $bytes=[Text.Encoding]::UTF8.GetBytes($text);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)
        return @{Path=$Path;Stream=$stream}
    } catch { $stream.Dispose(); throw }
}
function Exit-ResourcePublicationLock($Lock) {
    if(-not $Lock -or -not $Lock.Stream){throw 'Missing held publication lock'}
    $Lock.Stream.Dispose()
    Remove-Item -LiteralPath $Lock.Path -Force -ErrorAction Stop
}
function Complete-ResourcePublicationLock($Lock,[bool]$MutationStarted,[bool]$Verified) {
    if($MutationStarted -and -not $Verified){$Lock.Stream.Dispose();Write-Warning 'Publication outcome needs inspection; lock retained'}
    else {Exit-ResourcePublicationLock $Lock}
}
