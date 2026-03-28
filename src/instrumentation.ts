export async function register() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (process.env.NEXT_RUNTIME === 'nodejs' && proxyUrl) {
    try {
      const { setGlobalDispatcher, EnvHttpProxyAgent } = await import('undici');
      setGlobalDispatcher(new EnvHttpProxyAgent());
    } catch {
      // Cloudflare Workers or undici not available
    }
  }
}
