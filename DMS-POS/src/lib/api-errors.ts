import axios from 'axios'

const DAY_LOCK_MSG =
  'Today has been locked by the administrator. Changes are no longer allowed.'

export function getDayLockUserMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null
  const data = err.response?.data as { error?: { code?: string } } | undefined
  if (data?.error?.code === 'DayLocked') return DAY_LOCK_MSG
  return null
}

export function formatSubmitError(err: unknown): string {
  const day = getDayLockUserMessage(err)
  if (day) return day
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as {
      error?: { message?: string; code?: string; Message?: string }
      Error?: { message?: string; Message?: string }
    } | undefined
    const m =
      data?.error?.message
      ?? data?.error?.Message
      ?? data?.Error?.message
      ?? data?.Error?.Message
    if (m) return String(m)
    if (err.response) {
      const status = err.response.status
      if (status === 401) return 'Your session expired. Please sign in again.'
      if (status === 403) return 'You do not have permission for this action.'
      if (status >= 500) {
        const raw = err.response.data
        const detail =
          typeof raw === 'string'
            ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
            : typeof raw === 'object' && raw !== null
              ? String(
                  (raw as Record<string, unknown>).detail
                    ?? (raw as Record<string, unknown>).title
                    ?? (raw as Record<string, unknown>).message
                    ?? '',
                ).trim()
              : ''
        if (detail) return `Server error (${status}): ${detail}`
        return 'The server had a problem. Try again later.'
      }
    }
    // No HTTP response: wrong URL, backend down, CORS, blocked mixed content, etc.
    if (isUnreachableNetworkError(err)) {
      return 'Could not reach the server. Check the network connection and that the system is online.'
    }
  }
  if (err instanceof Error) return err.message
  return 'Request failed'
}

/** True when there is no HTTP response (timeout, DNS, backend down). */
export function isUnreachableNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (err.response) return false
  return (
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    (typeof err.message === 'string' &&
      (err.message === 'Network Error' || err.message.includes('Network Error')))
  )
}

export function isConflictStatus(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 409
}

/** True when the server already persisted the document (retry / duplicate click). */
export function isAlreadyRecordedError(err: unknown): boolean {
  if (isConflictStatus(err)) return true
  const msg = formatSubmitError(err).toLowerCase()
  return (
    msg.includes('already exists') ||
    msg.includes('already been submitted') ||
    msg.includes('already submitted')
  )
}
