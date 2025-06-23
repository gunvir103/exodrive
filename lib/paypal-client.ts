import { Client, Environment } from '@paypal/paypal-server-sdk';
import { getRedisClient } from '@/lib/redis/redis-client';

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'sandbox' 
    ? 'https://api-m.sandbox.paypal.com' 
    : 'https://api-m.paypal.com';

export async function getPayPalAccessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('PayPal client ID or secret not found in environment variables.');
    }

    const redis = getRedisClient();
    const cacheKey = `paypal:access_token:${process.env.PAYPAL_MODE || 'sandbox'}`;
    
    // Try to get token from cache first
    if (redis) {
        try {
            const cachedToken = await redis.get(cacheKey);
            if (cachedToken && typeof cachedToken === 'string') {
                console.log('[PayPal] Using cached access token');
                return cachedToken;
            }
        } catch (cacheError) {
            console.error('[PayPal] Cache read error:', cacheError);
            // Continue without cache on error
        }
    }

    // Fetch new token from PayPal
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${auth}`
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to get PayPal access token: ${response.statusText} ${errorBody}`);
    }

    const data = await response.json();
    const token = data.access_token;
    
    // Cache the token with 8-hour TTL (28800 seconds)
    // PayPal tokens typically expire after 9 hours, so 8 hours provides a safety margin
    if (redis && token) {
        try {
            await redis.setex(cacheKey, 28800, token); // 8 hour TTL
            console.log('[PayPal] Cached access token with 8-hour TTL');
        } catch (cacheError) {
            console.error('[PayPal] Cache write error:', cacheError);
            // Continue without caching on error
        }
    }
    
    return token;
}

function getPayPalEnvironment(): Environment {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const isSandbox = process.env.PAYPAL_MODE === 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal client ID or secret not found in environment variables.');
  }

  if (isSandbox) {
    return Environment.Sandbox;
  }
  return Environment.Production;
}

let payPalClientInstance: Client | null = null;

export function getPayPalClient(): Client {
    if (!payPalClientInstance) {
        const environment = getPayPalEnvironment();
        payPalClientInstance = new Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
                oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
            },
            environment: environment,
        });
    }
    return payPalClientInstance;
} 