import { NextApiRequest, NextApiResponse } from 'next';
import { getApiUrl } from '@/utils/app/api-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, token, backend_url } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token are required' });
  }

  try {
    // Check backend configuration to determine auth method (server-side compatible)
    // TEMPORARY: Force body auth to match backend config
    let useHeaderAuth = false; // Force body auth
    console.log(`🔐 FORCED: Using body auth method to match backend`);
    
    // Original code (commented out for testing):
    // try {
    //   if (process.env.NEXT_PUBLIC_JIRA_AUTH_METHOD) {
    //     const envAuthMethod = process.env.NEXT_PUBLIC_JIRA_AUTH_METHOD.toLowerCase();
    //     useHeaderAuth = envAuthMethod === 'header';
    //     console.log(`🔐 Using auth method from environment: ${envAuthMethod}`);
    //   } else {
    //     useHeaderAuth = true;
    //     console.log(`🔐 Using default server-side auth method: header`);
    //   }
    // } catch (error) {
    //   console.warn('🔐 Failed to determine auth method, defaulting to header auth:', error);
    //   useHeaderAuth = true;
    // }
    
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
      // Preserve the original status code from the backend
      res.status(response.status).json({ 
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