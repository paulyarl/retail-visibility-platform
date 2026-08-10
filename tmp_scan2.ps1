$content = Get-Content 'errors\mpt-6vrf6xtz-request.md' -Raw
# Test each DANGEROUS_PATTERN from input-validation.ts
$patterns = @(
    'UNION\s+SELECT\b(?=\s*(?:\*|ALL\b|DISTINCT\b|\w+\s+\bFROM\b))',
    'SELECT\s+(?:\*|[\w\s,]+?)\s+\bFROM\s+[\w"]+\b(?=\s*(?:;|WHERE\b|JOIN\b|GROUP\b|ORDER\b|LIMIT\b|HAVING\b|INTERSECT\b|UNION\b|EXCEPT\b|ON\b|INNER\b|LEFT\b|RIGHT\b|CROSS\b|SELECT\b|INSERT\b|UPDATE\b|DELETE\b|DROP\b|CREATE\b|ALTER\b|EXEC\b|EXECUTE\b|$))',
    'INSERT\s+INTO\s+[\w"]+\b(?=\s*(?:\(|;|SELECT\b|VALUES\b|$))',
    'UPDATE\s+[\w"]+\s+SET\s+\w+\s*(?==)',
    'DELETE\s+FROM\s+[\w"]+\b',
    'DROP\s+TABLE\s+[\w"]+\b',
    'CREATE\s+TABLE\s+[\w"]+\b',
    'ALTER\s+TABLE\s+[\w"]+\b',
    'EXEC\s*\(|EXECUTE\s*\(',
    '<script|javascript:|vbscript:|onload=|onerror=|onclick=|onmouseover=',
    '\.\.|/etc/passwd|/etc/shadow|/proc/|/home/',
    '(?<!-)--(?=\s)|/\*|\*/',
    'eval\(',
    'Function\(',
    'setTimeout\(',
    'setInterval\(',
    'document\.',
    'window\.',
    'localStorage\.',
    'sessionStorage\.'
)
for ($i = 0; $i -lt $patterns.Count; $i++) {
    try {
        $m = [regex]::Matches($content, $patterns[$i], 'IgnoreCase')
        if ($m.Count -gt 0) {
            Write-Host "Pattern $i : $($m.Count) matches"
            foreach ($match in ($m | Select-Object -First 3)) {
                $s = [Math]::Max(0, $match.Index - 50)
                $l = [Math]::Min(120, $content.Length - $s)
                Write-Host "  ...$($content.Substring($s, $l))..."
            }
        }
    } catch {
        Write-Host "Pattern $i : ERROR - $($_.Exception.Message)"
    }
}
