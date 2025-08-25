// Basic API client for future backend integration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  headers?: Record<string, string>
  body?: any
  cache?: RequestCache
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
  }
}

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body, cache } = options

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    cache,
  }

  if (body) {
    requestOptions.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions)

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(`API request failed: ${errorText}`, response.status)
  }

  // For 204 No Content responses
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// Hero content specific API functions
export interface HeroContentResponse {
  data: {
    id: string
    title: string
    subtitle: string
    backgroundType: "image" | "video"
    backgroundSrc: string
    badgeText: string
    primaryButtonText: string
    primaryButtonLink: string
    secondaryButtonText: string
    secondaryButtonLink: string
    isActive: boolean
  }
}

export const heroContentApi = {
  getActiveHero: () => apiRequest<HeroContentResponse>("/hero-content/active"),
  getAllHeroes: () => apiRequest<{ data: HeroContentResponse["data"][] }>("/hero-content"),
  updateHero: (id: string, data: Partial<HeroContentResponse["data"]>) =>
    apiRequest<HeroContentResponse>(`/hero-content/${id}`, {
      method: "PUT",
      body: data,
    }),
  createHero: (data: Omit<HeroContentResponse["data"], "id">) =>
    apiRequest<HeroContentResponse>("/hero-content", {
      method: "POST",
      body: data,
    }),
  deleteHero: (id: string) =>
    apiRequest<void>(`/hero-content/${id}`, {
      method: "DELETE",
    }),
}

