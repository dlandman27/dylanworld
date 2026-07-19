import type { AnalyticsConfig } from '../types'

/** Empty measurementId disables analytics (dev/preview stay clean). */
export const analytics: AnalyticsConfig = { measurementId: '' }
