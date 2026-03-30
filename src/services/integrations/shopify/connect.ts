/**
 * Shopify OAuth: build redirect URL and register state for callback validation.
 */

import { randomBytes } from 'node:crypto'
import * as store from './store.js'

const clientId = process.env.SHOPIFY_CLIENT_ID ?? ''
const scopes = process.env.SHOPIFY_SCOPES ?? 'read_orders'
const redirectUri = process.env.SHOPIFY_REDIRECT_URI ?? ''

export interface ConnectResult {
  redirectUrl: string
  state: string
}

/**
 * Start Shopify OAuth: generate state, store it, return redirect URL.
 * Caller should redirect the user to redirectUrl.
 */
export function startConnect(shop: string): ConnectResult {
  const state = randomBytes(16).toString('hex')
  const normalizedShop = shop.trim().toLowerCase().replace(/\.myshopify\.com$/i, '')
  const shopHost = normalizedShop ? `${normalizedShop}.myshopify.com` : ''

  if (!clientId || !redirectUri || !shopHost) {
    throw new Error('Missing SHOPIFY_CLIENT_ID, SHOPIFY_REDIRECT_URI, or invalid shop')
  }

  store.setOAuthState(state, shopHost)

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  })
  const redirectUrl = `https://${shopHost}/admin/oauth/authorize?${params.toString()}`

  return { redirectUrl, state }
}
