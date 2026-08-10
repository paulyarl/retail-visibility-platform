$content = Get-Content 'errors\mpt-6vrf6xtz-request.md' -Raw
$m = [regex]::Matches($content, '\.\.', 'IgnoreCase')
Write-Host "Total .. matches: $($m.Count)"
foreach ($match in $m) {
    $s = [Math]::Max(0, $match.Index - 60)
    $l = [Math]::Min(140, $content.Length - $s)
    Write-Host "  Index $($match.Index): [$($content.Substring($s, $l))]"
}
