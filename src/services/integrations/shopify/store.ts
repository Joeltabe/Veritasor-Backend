/**
 * In-memory store for Shopify OAuth state (nonce → shop) and tokens.
 * Replace with DB-backed repository when persisting integrations.
 * Tokens are never logged.
 */

const stateToShop = new Map<string, string>()
const shopTokens = new Map<string, string>()

export function setOAuthState(state: string, shop: string): void {
  stateToShop.set(state, shop)
}

export function consumeOAuthState(state: string): string | undefined {
  const shop = stateToShop.get(state)
  stateToShop.delete(state)
  return shop
}

export function saveToken(shop: string, accessToken: string): void {
  shopTokens.set(normalizeShop(shop), accessToken)
}

export function getToken(shop: string): string | undefined {
  return shopTokens.get(normalizeShop(shop))
}

function normalizeShop(shop: string): string {
  const s = shop.trim().toLowerCase()
  return s.endsWith('.myshopify.com') ? s : `${s}.myshopify.com`
}
