import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from the request headers or use default
    const backendUrl = req.headers['x-backend-url'] as string || 'http://localhost:8080';
    
    console.log('🔧 MFA Clear Session Proxy: Forwarding request to:', `${backendUrl}/api/mfa/clear-session`);
    
    // Forward the request to the actual backend
    // Forward cookies for JWT session validation
    const forwardHeaders: any = {
      'Content-Type': 'application/json',
    };
    
    if (req.headers.cookie) {
      forwardHeaders['Cookie'] = req.headers.cookie;
    }
    
    const response = await fetch(`${backendUrl}/api/mfa/clear-session`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ MFA Clear Session Proxy: Request successful');
      res.status(200).json(data);
    } else {
      console.log('❌ MFA Clear Session Proxy: Request failed:', response.status);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ MFA Clear Session Proxy: Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
