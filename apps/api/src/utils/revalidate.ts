export async function triggerRevalidate(tenantId: string, paths?: string[]) {
  try {
    const WEB_URL = process.env.WEB_URL || 'http://localhost:3000'
    const secret = process.env.REVALIDATE_SECRET || ''
    const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''
    
    // Build URL with bypass token if available (for Vercel deployment protection)
    let url = `${WEB_URL.replace(/\/$/, '')}/api/revalidate`
    if (bypassToken) {
      url += `?x-vercel-protection-bypass=${encodeURIComponent(bypassToken)}`
    }
    
    const payload = { tenantId, paths }

    // simple retry: 3 attempts with backoff
    let attempt = 0
    let lastErr: any = null
    while (attempt < 3) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': secret,
          },
          body: JSON.stringify(payload),
        })
        if (res.ok) return true
        lastErr = await res.text().catch(() => res.statusText)
      } catch (e) {
        lastErr = e
      }
      await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)))
      attempt++
    }
    // eslint-disable-next-line no-console
    console.warn('[revalidate] failed', { tenantId, error: String(lastErr) })
  } catch {}
  return false
}
