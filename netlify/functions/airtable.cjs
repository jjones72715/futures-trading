    exports.handler = async (event) => {
      const TOKEN = "patIocMMJeO1lbzlm.d9ea1e76994175893ff166925528aed82f3caea1eb9126a096b16cebade88cd5";
      const BASE_URL = "https://api.airtable.com/v0";

      const path = event.path.replace('/.netlify/functions/airtable', '');
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
          statusCode: 200,
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
  