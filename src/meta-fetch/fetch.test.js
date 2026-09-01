
import { test, expect, vi, beforeAll } from 'vitest'
import { initFetch, htmlInit, jsonInit, redirect } from './fetch'

// initFetch is a one-shot initializer; call it once for the whole file.
let mockResponse
const mockFetch = vi.fn(async () => mockResponse)

beforeAll(() => {
  initFetch(mockFetch, 'TestUA/1.0')
})

test('user-agent', () => {
  for (const init of [htmlInit, jsonInit]) {
    expect(init.headers['user-agent']).toBe('TestUA/1.0')
  }
})

test('redirect', async () => {
  mockResponse = new Response(null, { headers: { location: 'https://redir.example/path' } })
  mockFetch.mockClear()
  await expect(redirect('https://example.com/')).resolves.toBe('https://redir.example/path')
  expect(mockFetch).toHaveBeenCalledTimes(1)
  expect(mockFetch).toHaveBeenCalledWith('https://example.com/', htmlInit)

  mockResponse = new Response(null)
  await expect(redirect('https://example.com/')).resolves.toBeNull()
})
