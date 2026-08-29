const rawApiUrl = (import.meta.env.VITE_KIGO_API_URL ?? '').trim()
const normalizedApiUrl = rawApiUrl && rawApiUrl.startsWith('https://verify-api.kigo.dev')
  ? '/api/kigo/v1'
  : (rawApiUrl || '/api/kigo/v1')

const API_BASE_URL = normalizedApiUrl.replace(/\/$/, '')
const API_KEY = (import.meta.env.VITE_KIGO_API_KEY ?? '').trim()

function buildHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    ...extra,
  }
}

export async function createEnrollment(externalRef, metadata = {}) {
  if (!API_KEY) {
    throw new Error('Falta VITE_KIGO_API_KEY en el archivo .env')
  }

  const response = await fetch(`${API_BASE_URL}/enrollments`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      external_ref: String(externalRef),
      metadata: metadata ?? {},
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Error al crear el enrolamiento (${response.status})`)
  }

  return payload
}

export async function getEnrollment(id) {
  if (!API_KEY) {
    throw new Error('Falta VITE_KIGO_API_KEY en el archivo .env')
  }

  const response = await fetch(`${API_BASE_URL}/enrollments/${id}`, {
    method: 'GET',
    headers: buildHeaders(),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Error al consultar el enrolamiento (${response.status})`)
  }

  return payload
}

export async function getPhoto(id) {
  if (!API_KEY) {
    throw new Error('Falta VITE_KIGO_API_KEY en el archivo .env')
  }

  const response = await fetch(`${API_BASE_URL}/enrollments/${id}/photo`, {
    method: 'GET',
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.message || payload?.error || `No se pudo descargar la foto (${response.status})`)
  }

  return response.blob()
}
