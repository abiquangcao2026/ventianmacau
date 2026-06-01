function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(String(hostname || '').toLowerCase())
}

function buildRuntimeOrigin() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000'
  }

  return trimTrailingSlash(window.location.origin)
}

function resolveConfiguredBaseUrl(rawValue) {
  const normalized = trimTrailingSlash(rawValue)
  if (!normalized) {
    return buildRuntimeOrigin()
  }

  if (typeof window === 'undefined') {
    return normalized
  }

  try {
    const parsed = new URL(normalized)
    if (!isLocalHostname(window.location.hostname) && isLocalHostname(parsed.hostname)) {
      return buildRuntimeOrigin()
    }
  } catch {
    return trimTrailingSlash(new URL(normalized, window.location.origin).toString())
  }

  return normalized
}

function joinUrl(baseUrl, path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`
  return `${trimTrailingSlash(baseUrl)}${normalizedPath}`
}

const RUNTIME_API_BASE_URL = resolveConfiguredBaseUrl(import.meta.env.VITE_API_BASE_URL)
const CLIENT_BUILD_ID = '2026-04-27-whitefix-02'

async function extractBackendError(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null)
    const message = String(json?.message || '').trim()
    if (message) {
      return message
    }
  }

  const rawText = await response.text().catch(() => '')
  const cleaned = String(rawText || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned) {
    return cleaned.slice(0, 240)
  }

  return ''
}

export async function apiFetch(path, options = {}) {
  const primaryUrl = joinUrl(RUNTIME_API_BASE_URL, path)
  const fallbackUrl = joinUrl(buildRuntimeOrigin(), path)
  const shouldRetrySameOrigin = primaryUrl !== fallbackUrl
  const requestOptions = {
    ...options,
    headers: {
      'X-Client-Build': CLIENT_BUILD_ID,
      ...(options.headers || {})
    }
  }

  let response

  try {
    response = await fetch(primaryUrl, requestOptions)
  } catch (error) {
    if (shouldRetrySameOrigin) {
      try {
        response = await fetch(fallbackUrl, requestOptions)
      } catch (retryError) {
        const rootCause = retryError?.message || error?.message || 'Network error'
        throw new Error(`Không kết nối được backend (${rootCause}). Kiểm tra API/deploy hoặc VITE_API_BASE_URL.`)
      }
    } else {
      const rootCause = error?.message || 'Network error'
      throw new Error(`Không kết nối được backend (${rootCause}). Kiểm tra API/deploy hoặc VITE_API_BASE_URL.`)
    }
  }

  if (!response.ok) {
    const backendMessage = await extractBackendError(response)
    const suffix = backendMessage ? `: ${backendMessage}` : ''
    throw new Error(`HTTP ${response.status}${suffix}`)
  }

  const data = await response.json().catch(() => ({}))
  return data
}

export { RUNTIME_API_BASE_URL as API_BASE_URL }
export { CLIENT_BUILD_ID }
