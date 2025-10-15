import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the backend URL from the request headers or use default
    const backendUrl = req.headers['x-backend-url'] as string || 'http://localhost:8080';
    
    console.log('🔧 JIRA Disconnect Proxy: Forwarding request to:', `${backendUrl}/api/mfa/jira/disconnect`);
    
    // Forward the request to the actual backend
    // Forward cookies for JWT session validation
    const forwardHeaders: any = {
      'Content-Type': 'application/json',
    };
    
    if (req.headers.cookie) {
      forwardHeaders['Cookie'] = req.headers.cookie;
    }
    
    const response = await fetch(`${backendUrl}/api/mfa/jira/disconnect`, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ JIRA Disconnect Proxy: Backend credentials cleared successfully');
      res.status(200).json(data);
    } else {
      console.log('❌ JIRA Disconnect Proxy: Request failed:', response.status);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ JIRA Disconnect Proxy: Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

