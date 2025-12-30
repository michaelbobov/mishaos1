// Vercel serverless function to proxy OpenAI API calls
// This keeps your API key secure on the server side

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variable
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const { endpoint, body } = req.body;
    
    // Validate endpoint to prevent abuse
    const allowedEndpoints = [
      '/v1/chat/completions',
      '/v1/images/generations'
    ];
    
    if (!allowedEndpoints.includes(endpoint)) {
      return res.status(400).json({ error: 'Invalid endpoint' });
    }

    // For streaming requests, disable streaming and get full response
    // (Vercel serverless functions have limitations with streaming)
    const requestBody = { ...body };
    if (requestBody.stream === true) {
      requestBody.stream = false;
    }

    // Forward request to OpenAI
    const response = await fetch(`https://api.openai.com${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

