import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from the request headers or use default
    const backendUrl = req.headers['x-backend-url'] as string || 'http://localhost:8080';
    
    console.log('🔧 MFA Proxy: Forwarding request to:', `${backendUrl}/api/mfa/setup`);
    
    // Forward the request to the actual backend
    const response = await fetch(`${backendUrl}/api/mfa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ MFA Proxy: Request successful');
      res.status(200).json(data);
    } else {
      console.log('❌ MFA Proxy: Request failed:', response.status);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ MFA Proxy: Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
