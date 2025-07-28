import { NextApiRequest, NextApiResponse } from 'next';
import { getApiUrl, shouldUseHeaderAuth } from '@/utils/app/api-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, token, backend_url } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token are required' });
  }

  try {
    // Check backend configuration to determine auth method
    const useHeaderAuth = await shouldUseHeaderAuth();
    console.log(`🔐 JIRA validation using ${useHeaderAuth ? 'header' : 'body'} auth method`);
    
    // Use provided backend URL or fall back to configuration
    let backendUrl: string;
    if (backend_url) {
      backendUrl = `${backend_url}/api/mfa/jira/test-connection`;
      console.log(`🔗 Using provided backend URL: ${backend_url}`);
    } else {
      backendUrl = getApiUrl('/api/mfa/jira/test-connection');
      console.log(`🔗 Using configured backend URL: ${backendUrl}`);
    }
    
    let headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    let body: any = {};
    
    if (useHeaderAuth) {
      // Send credentials via Authorization header
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
      console.log('🔐 JIRA credentials added to Authorization header for validation');
    } else {
      // Send credentials in request body
      body = {
        jira_credentials: {
          username: username,
          token: token
        }
      };
      console.log('🔐 JIRA credentials added to request body for validation');
    }
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const result = await response.json();
      res.status(200).json({ 
        valid: true, 
        user: result.user || { displayName: username },
        backend_status: 'connected',
        auth_method: useHeaderAuth ? 'header' : 'body'
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      res.status(401).json({ 
        valid: false, 
        error: errorData.detail || 'Backend validation failed',
        backend_status: 'failed',
        auth_method: useHeaderAuth ? 'header' : 'body'
      });
    }
  } catch (error) {
    console.error('Backend JIRA validation error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to connect to backend server',
      backend_status: 'unreachable'
    });
  }
} 