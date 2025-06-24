import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, token } = req.body;

  if (!username || !token) {
    return res.status(400).json({ error: 'Username and token are required' });
  }

  try {
    // Test credentials by calling JIRA API - using a simple endpoint that requires authentication
    // We'll use the current user endpoint as it's lightweight and requires valid auth
    const jiraUrl = process.env.JIRA_DOMAIN || 'https://jirasw.nvidia.com';
    const testUrl = `${jiraUrl}/rest/api/2/myself`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const userData = await response.json();
      res.status(200).json({ 
        valid: true, 
        user: {
          displayName: userData.displayName,
          emailAddress: userData.emailAddress
        }
      });
    } else {
      // Authentication failed
      res.status(401).json({ 
        valid: false, 
        error: 'Invalid JIRA credentials' 
      });
    }
  } catch (error) {
    console.error('JIRA validation error:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to validate JIRA credentials' 
    });
  }
} 