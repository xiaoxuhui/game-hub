# Initial publication must use exact main. Recovery may use an older producer
# only if it is an ancestor of the freshly fetched, separately checked main.
function Assert-ResourcePublicationMain([bool]$Resume,[string]$Commit,[string]$RemoteTip,[string]$Repository) {
    if($Commit -notmatch '^[0-9a-f]{40}$' -or $RemoteTip -notmatch '^[0-9a-f]{40}$'){throw 'Invalid main/producer revision'}
    if(-not $Resume){if($Commit -cne $RemoteTip){throw 'Exact pushed main required'};return}
    git -C $Repository merge-base --is-ancestor $Commit $RemoteTip
    if($LASTEXITCODE -ne 0){throw 'Recovery producer is not an ancestor of current main'}
}
