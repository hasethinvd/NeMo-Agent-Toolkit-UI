# Staging Backend Configuration Guide

This guide shows how to configure your frontend to connect to the staging backend at:
**https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com**

## 🚀 Quick Start

### Option 1: Use the Staging Script (Recommended)
```bash
cd tpm-enterprise-ui
npm run dev:staging
```

### Option 2: Create .env.local file
Create `tpm-enterprise-ui/.env.local` with:

```bash
# Staging Backend Configuration (NO PORTS NEEDED!)
NEXT_PUBLIC_API_BASE_URL=https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com
NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL=https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/chat/stream
NEXT_PUBLIC_WS_CHAT_COMPLETION_URL=wss://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/websocket
NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON=true
NODE_TLS_REJECT_UNAUTHORIZED=0
INTERNAL_API_HOST=tpmjira-tpm-jira-aiq.stg.astra.nvidia.com
INTERNAL_API_PROTOCOL=https
INTERNAL_API_PORT=443
```

Then run: `npm run dev`

### Option 3: Docker with Environment Variables
```bash
cd tpm-enterprise-ui
export NEXT_PUBLIC_API_BASE_URL=https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com
export NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL=https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/chat/stream
export NEXT_PUBLIC_WS_CHAT_COMPLETION_URL=wss://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/websocket
export NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON=true
export NODE_TLS_REJECT_UNAUTHORIZED=0
export INTERNAL_API_HOST=tpmjira-tpm-jira-aiq.stg.astra.nvidia.com
export INTERNAL_API_PROTOCOL=https
export INTERNAL_API_PORT=443

docker-compose up --build
```

## ✅ What Should Happen

After starting with any of the above methods, your frontend settings should show:

- **HTTP/HTTPS URL for Chat Completion**: `https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/chat/stream`
- **WebSocket URL for Chat Completion**: `wss://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/websocket`

**NO MORE LOCALHOST URLs!** 🎯

## 🔧 Key Changes Made

1. ✅ Added `dev:staging` script with complete URLs (no ports)
2. ✅ Updated Docker Compose to support the staging environment variables
3. ✅ Configured both HTTP and WebSocket URLs to point to staging backend
4. ✅ Set proper SSL and internal host configurations

## 🧪 Testing

1. Start your frontend using one of the methods above
2. Open http://localhost:3000
3. Go to Settings (gear icon)
4. Verify the URLs show your staging domain (not localhost)
5. Try sending a chat message to test the connection

The frontend will now connect directly to your staging backend without any localhost references! 