import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from the request headers or use default
    const backendUrl = req.headers['x-backend-url'] as string || 'http://localhost:8080';
    const userId = req.query.user_id as string;
    
    console.log('🔧 MFA Status Proxy: Forwarding request to:', `${backendUrl}/api/mfa/status?user_id=${userId}`);
    
    // Forward the request to the actual backend
    const response = await fetch(`${backendUrl}/api/mfa/status?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ MFA Status Proxy: Request successful');
      res.status(200).json(data);
    } else {
      console.log('❌ MFA Status Proxy: Request failed:', response.status);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ MFA Status Proxy: Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
