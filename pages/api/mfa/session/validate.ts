import { NextApiRequest, NextApiResponse } from 'next';
import { httpsFetch } from '@/utils/app/https-fetch';
import { getApiUrl } from '@/utils/app/api-config';

interface MFASessionValidateResponse {
  valid: boolean;
  user_id?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MFASessionValidateResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { session_id, user_id } = req.query;

    if (!session_id || !user_id) {
      return res.status(400).json({
        valid: false,
        error: 'Missing session_id or user_id parameter'
      });
    }

    // Call Python backend to validate MFA session
    const response = await httpsFetch(getApiUrl(`/api/mfa/session/validate?session_id=${session_id}&user_id=${user_id}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`MFA session validate API error: ${response.status}`);
      return res.status(200).json({
        valid: false,
        error: 'Session validation failed'
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('MFA session validation error:', error);
    res.status(200).json({
      valid: false,
      error: 'Connection error'
    });
  }
} 