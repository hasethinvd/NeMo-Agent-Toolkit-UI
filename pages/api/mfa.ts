import { NextApiRequest, NextApiResponse } from 'next';

interface MFASetupResponse {
  success: boolean;
  qr_code?: string;
  backup_codes?: string[];
  error?: string;
}

interface MFAVerifyResponse {
  success: boolean;
  session_id?: string;
  error?: string;
}

interface MFAStatusResponse {
  enabled: boolean;
  backup_codes_remaining?: number;
  has_active_session?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MFASetupResponse | MFAVerifyResponse | MFAStatusResponse>
) {
  const { method } = req;

  // Get user ID from headers or request body
  let userId = req.headers['x-user-id'] as string;
  let userEmail = req.headers['x-user-email'] as string;
  
  // For DELETE requests, also check the request body
  if (method === 'DELETE' && req.body?.user_id) {
    userId = req.body.user_id;
    userEmail = `${userId}@nvidia.com`;
  }
  
  // Fallback to default only if no user ID provided
  if (!userId) {
    userId = 'aiq-tpm-system';
    userEmail = userEmail || 'aiq-tpm-system@your-organization.com';
  } else if (!userEmail) {
    userEmail = `${userId}@nvidia.com`;
  }

  switch (method) {
    case 'POST':
      return handleMFASetup(req, res, userId, userEmail);
    case 'PUT':
      return handleMFAVerify(req, res, userId);
    case 'GET':
      return handleMFAStatus(req, res, userId);
    case 'DELETE':
      return handleMFADisable(req, res, userId);
    default:
      res.setHeader('Allow', ['POST', 'PUT', 'GET', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

async function handleMFASetup(
  req: NextApiRequest,
  res: NextApiResponse<MFASetupResponse>,
  userId: string,
  userEmail: string
) {
  try {
    // Call Python backend to setup MFA
    const response = await fetch('http://localhost:8000/mfa/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        user_email: userEmail,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json({
      success: true,
      qr_code: data.qr_code,
      backup_codes: data.backup_codes,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup MFA',
    });
  }
}

async function handleMFAVerify(
  req: NextApiRequest,
  res: NextApiResponse<MFAVerifyResponse>,
  userId: string
) {
  try {
    const { code, is_backup_code = false } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'MFA code is required',
      });
    }

    // Call Python backend to verify MFA
    const response = await fetch('http://localhost:8000/mfa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        code: code,
        is_backup_code: is_backup_code,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json({
      success: data.success,
      session_id: data.session_id,
      error: data.success ? undefined : 'Invalid MFA code',
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA code',
    });
  }
}

async function handleMFAStatus(
  req: NextApiRequest,
  res: NextApiResponse<MFAStatusResponse>,
  userId: string
) {
  try {
    // Call Python backend to get MFA status
    const response = await fetch(`http://localhost:8000/mfa/status?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(200).json({
      enabled: false,
      backup_codes_remaining: 0,
      has_active_session: false,
    });
  }
}

async function handleMFADisable(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; error?: string }>,
  userId: string
) {
  try {
    // Call Python backend to disable MFA
    const response = await fetch('http://localhost:8000/mfa/disable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json({
      success: data.success,
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable MFA',
    });
  }
} 