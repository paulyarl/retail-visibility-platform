$content = Get-Content 'errors\mpt-6vrf6xtz-request.md' -Raw
$patterns = [ordered]@{
    'SQL comment (-- )' = '(?<!-)--(?=\s)'
    'Block open (/*)' = '/\*'
    'Block close (*/)' = '\*/'
    'XSS script' = '<script'
    'javascript:' = 'javascript:'
    '/home/' = '/home/'
    '/etc/' = '/etc/'
    '/proc/' = '/proc/'
    'onload=' = 'onload='
    'onerror=' = 'onerror='
    'onclick=' = 'onclick='
    'onmouseover=' = 'onmouseover='
    'vbscript:' = 'vbscript:'
    'UNION SELECT' = 'UNION\s+SELECT'
    'SELECT FROM' = 'SELECT\s+.+?\s+FROM'
    'DELETE FROM' = 'DELETE\s+FROM'
    'DROP TABLE' = 'DROP\s+TABLE'
    'INSERT INTO' = 'INSERT\s+INTO'
    'UPDATE SET' = 'UPDATE\s+.+?\s+SET'
    'CREATE TABLE' = 'CREATE\s+TABLE'
    'ALTER TABLE' = 'ALTER\s+TABLE'
    'EXEC(' = 'EXEC\s*\('
    'EXECUTE(' = 'EXECUTE\s*\('
    'eval(' = 'eval\('
    'Function(' = 'Function\('
    'setTimeout(' = 'setTimeout\('
    'document.' = 'document\.'
    'window.' = 'window\.'
    'localStorage.' = 'localStorage\.'
}
foreach ($entry in $patterns.GetEnumerator()) {
    $m = [regex]::Matches($content, $entry.Value, 'IgnoreCase')
    if ($m.Count -gt 0) {
        Write-Host "$($entry.Key): $($m.Count) matches"
        foreach ($match in ($m | Select-Object -First 3)) {
            $s = [Math]::Max(0, $match.Index - 40)
            $l = [Math]::Min(100, $content.Length - $s)
            Write-Host "  ...$($content.Substring($s, $l))..."
        }
    }
}
