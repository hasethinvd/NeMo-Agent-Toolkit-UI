import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from the request headers or use default
    const backendUrl = req.headers['x-backend-url'] as string || 'http://localhost:8080';
    
    console.log('🔧 MFA Verify Proxy: Forwarding request to:', `${backendUrl}/api/mfa/verify`);
    
    // Forward the request to the actual backend with cookies
    const forwardHeaders: any = {
      'Content-Type': 'application/json',
    };
    
    // Forward cookies if they exist (for JWT session validation)
    if (req.headers.cookie) {
      forwardHeaders['Cookie'] = req.headers.cookie;
    }
    
    const response = await fetch(`${backendUrl}/api/mfa/verify`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ MFA Verify Proxy: Request successful');
      res.status(200).json(data);
    } else {
      console.log('❌ MFA Verify Proxy: Request failed:', response.status);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ MFA Verify Proxy: Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
