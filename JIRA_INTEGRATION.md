# JIRA Integration

This UI now supports JIRA token and username configuration directly from the settings dialog.

## Features Added

### Settings Dialog Enhancement
- Added JIRA Username and JIRA Token fields in the settings dialog
- Added JIRA connection status indicator
- Credentials are stored securely in browser's sessionStorage

### State Management
- Extended `HomeInitialState` to include `jiraToken` and `jiraUsername`
- Added JIRA credentials to settings type definitions
- Created utility functions for JIRA credential management

### API Integration
- Modified chat API to include JIRA credentials in requests when available
- Credentials are automatically passed to backend endpoints

## Usage

1. **Open Settings**: Click the settings button in the UI
2. **Configure JIRA**: 
   - Enter your JIRA username
   - Enter your JIRA API token (generate from JIRA → Account Settings → Security → API Tokens)
3. **Save Settings**: Click Save to store the credentials
4. **Check Status**: The JIRA connection status will show as connected/disconnected

## Files Modified

- `pages/api/home/home.state.tsx` - Added JIRA state properties
- `components/Settings/SettingDialog.tsx` - Added JIRA credential fields
- `types/settings.ts` - Extended Settings interface
- `utils/app/settings.ts` - Added JIRA utility functions
- `pages/api/chat.ts` - Include JIRA credentials in API requests

## Files Added

- `components/Settings/JiraStatus.tsx` - JIRA connection status component

## Security Notes

- Credentials are stored in browser's sessionStorage (not localStorage for security)
- Credentials are only sent to backend when both username and token are present
- API tokens should be generated specifically for this application with minimal required permissions

## Environment Variables (Optional)

You can set default values using environment variables:
- `NEXT_PUBLIC_JIRA_TOKEN` - Default JIRA token
- `NEXT_PUBLIC_JIRA_USERNAME` - Default JIRA username

These will be overridden by user-configured values in the settings dialog. 