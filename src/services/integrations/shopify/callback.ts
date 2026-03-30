/**
 * Shopify OAuth callback: validate state, exchange code for access token, store token.
 * Access tokens are never logged.
 */

import * as store from './store.js'

const clientId = process.env.SHOPIFY_CLIENT_ID ?? ''
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET ?? ''

const SHOP_HOST_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.myshopify\.com$/

export interface CallbackParams {
  code: string
  shop: string
  state: string
}

export interface CallbackResult {
  success: boolean
  shop?: string
  error?: string
}

/**
 * Handle OAuth callback: consume state, exchange code for token, persist via integration store.
 */
export async function handleCallback(params: CallbackParams): Promise<CallbackResult> {
  const { code, shop, state } = params

  if (!code || !shop || !state) {
    return { success: false, error: 'Missing code, shop, or state' }
  }

  const normalizedShop = shop.trim().toLowerCase()
  const shopHost = normalizedShop.endsWith('.myshopify.com')
    ? normalizedShop
    : `${normalizedShop.replace(/\.myshopify\.com$/i, '')}.myshopify.com`
  if (!SHOP_HOST_REGEX.test(shopHost)) {
    return { success: false, error: 'Invalid shop hostname' }
  }

  const storedShop = store.consumeOAuthState(state)
  if (!storedShop || storedShop !== shopHost) {
    return { success: false, error: 'Invalid or expired state' }
  }

  if (!clientId || !clientSecret) {
    return { success: false, error: 'Shopify app not configured' }
  }

  const tokenUrl = `https://${shopHost}/admin/oauth/access_token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
  })

  let res: Response
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    })
  } catch (err) {
    return { success: false, error: 'Token exchange request failed' }
  }

  if (!res.ok) {
    return { success: false, error: 'Token exchange failed' }
  }

  const data = (await res.json()) as { access_token?: string }
  const accessToken = data?.access_token
  if (!accessToken || typeof accessToken !== 'string') {
    return { success: false, error: 'No access token in response' }
  }

  store.saveToken(shopHost, accessToken)
  return { success: true, shop: shopHost }
}
