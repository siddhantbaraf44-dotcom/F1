exports.handler = async (event) => {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Missing TMDB_API_KEY' }) };
    }

    const path = event.queryStringParameters?.path;
    if (!path) {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Missing path parameter' }) };
    }

    const url = new URL(`https://api.themoviedb.org/3${path.startsWith('/') ? path : '/' + path}`);
    url.searchParams.set('api_key', apiKey);

    const params = event.queryStringParameters || {};
    for (const [key, value] of Object.entries(params)) {
      if (key === 'path' || value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'public, max-age=300'
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Proxy error' })
    };
  }
};
