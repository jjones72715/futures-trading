exports.handler = async (event) => {
  const TOKEN = "patIocMMJeO1lbzlm.c34342b06deba92090aacdb92686c8bc1479be242f03adf24cc9d0c32f1dfb60";
  const BASE_URL = "https://api.airtable.com/v0";
  const path = event.path.replace('/.netlify/functions/cc-airtable', '');
  const url = `${BASE_URL}${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;
  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PATCH', 'PUT'].includes(event.httpMethod) ? event.body : undefined,
    });
    const data = await response.json();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch(e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
