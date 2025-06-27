import { NextApiRequest, NextApiResponse } from 'next';

interface MFAStatusResponse {
  enabled: boolean;
  backup_codes_remaining?: number;
  has_active_session?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MFAStatusResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Get user ID from query parameter or use consistent default
    const userId = req.query.user_id as string || 'aiq-tpm-system';

    // Call Python backend to get MFA status
    const response = await fetch(`http://localhost:8000/mfa/status?user_id=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`MFA status API error: ${response.status}`);
      // Return default disabled status instead of throwing error
      return res.status(200).json({
        enabled: false,
        backup_codes_remaining: 0,
        has_active_session: false,
      });
    }

    const data = await response.json();
    
    res.status(200).json(data);
  } catch (error) {
    console.error('MFA status error:', error);
    // Return default disabled status on error
    res.status(200).json({
      enabled: false,
      backup_codes_remaining: 0,
      has_active_session: false,
    });
  }
} 