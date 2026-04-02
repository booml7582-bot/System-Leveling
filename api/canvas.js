// ============================================
// Vercel Serverless Proxy for Canvas LMS API
// ============================================
// Bypasses CORS by making Canvas API calls server-side.
// The client POSTs { domain, token, endpoint } and this
// function forwards the request to Canvas and returns the result.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, token, endpoint } = req.body || {};

  if (!domain || !token || !endpoint) {
    return res.status(400).json({ error: 'Missing required fields: domain, token, endpoint' });
  }

  // Normalize domain
  let baseUrl = domain.trim().replace(/\/+$/, '');
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = 'https://' + baseUrl;
  }

  const apiUrl = `${baseUrl}/api/v1${endpoint}`;
  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${apiUrl}${separator}access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({
        error: 'Invalid API token. Go to Canvas > Account > Settings > "+ New Access Token" to generate a new one.',
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Canvas API error (HTTP ${response.status}): ${text.slice(0, 200)}`,
      });
    }

    const data = await response.json();

    // Set CORS headers so the client can read the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      error: `Failed to reach Canvas: ${e.message}`,
    });
  }
}
