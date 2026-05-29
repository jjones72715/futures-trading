exports.handler = async (event) => {
  const TOKEN = process.env.AIRTABLE_API_KEY;
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
