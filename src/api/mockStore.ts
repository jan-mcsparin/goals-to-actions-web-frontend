// In-memory stand-in for the API's database. Changes last until the page
// reloads. Only client.ts imports this.
import { buildMockData, type MockData } from './mockData.ts'

export let store: MockData = buildMockData(new Date())

export function resetStore(): void {
  store = buildMockData(new Date())
}
