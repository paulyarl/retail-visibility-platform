type Counter = { inc(labels?: Record<string,string>): void }
type Histogram = { observe(v: number, labels?: Record<string,string>): void }

const counts: Record<string, number> = {}

export const metrics = {
  counter(name: string): Counter {
    return {
      inc(labels?: Record<string,string>) {
        const key = labels ? `${name}${JSON.stringify(labels)}` : name
        counts[key] = (counts[key] || 0) + 1
        if (process.env.METRICS_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log('[metric]', name, 'inc', labels || {})
        }
      },
    }
  },
  histogram(name: string): Histogram {
    return {
      observe(v: number, labels?: Record<string,string>) {
        if (process.env.METRICS_DEBUG === 'true') {
          // eslint-disable-next-line no-console
          console.log('[metric]', name, v, labels || {})
        }
      },
    }
  },
}

export const gbpHoursSuccess = metrics.counter('gbp_hours_sync_success_total')
export const gbpHoursFail = metrics.counter('gbp_hours_sync_fail_total')
export const gbpHoursDurationMs = metrics.histogram('gbp_hours_sync_last_duration_ms')

// Category mirror telemetry
export const categoryMirrorSuccess = metrics.counter('category_mirror_success_total')
export const categoryMirrorFail = metrics.counter('category_mirror_fail_total')
export const categoryMirrorDurationMs = metrics.histogram('category_mirror_last_duration_ms')
export const categoryOutOfSyncDetected = metrics.counter('gbp_sync_out_of_sync_detected')

// M4: SKU Scanning telemetry
export const scanSessionStarted = metrics.counter('scan_session_started_total')
export const scanSessionCompleted = metrics.counter('scan_session_completed_total')
export const scanSessionCancelled = metrics.counter('scan_session_cancelled_total')
export const scanBarcodeSuccess = metrics.counter('scan_barcode_success_total')
export const scanBarcodeFail = metrics.counter('scan_barcode_fail_total')
export const scanBarcodeDuplicate = metrics.counter('scan_barcode_duplicate_total')
export const scanCommitSuccess = metrics.counter('scan_commit_success_total')
export const scanCommitFail = metrics.counter('scan_commit_fail_total')
export const scanCommitDurationMs = metrics.histogram('scan_commit_duration_ms')
export const scanValidationError = metrics.counter('scan_validation_error_total')

// Enrichment telemetry
export const enrichmentCacheHit = metrics.counter('enrichment_cache_hit_total')
export const enrichmentCacheMiss = metrics.counter('enrichment_cache_miss_total')
export const enrichmentApiSuccess = metrics.counter('enrichment_api_success_total')
export const enrichmentApiFail = metrics.counter('enrichment_api_fail_total')
export const enrichmentDurationMs = metrics.histogram('enrichment_duration_ms')
export const enrichmentFallback = metrics.counter('enrichment_fallback_total')
