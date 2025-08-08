# Docker Configuration for TPM Assistant UI

This document explains how to run the TPM Assistant UI in Docker with dynamic backend configuration.

## 🐳 Quick Start

### Using Docker Compose (Recommended)

```bash
# For HTTPS backend (default)
docker-compose up

# For HTTP backend on port 9090
API_PROTOCOL=http API_PORT=9090 WS_PROTOCOL=ws docker-compose up

# For custom backend host
API_HOST=192.168.1.100 API_PORT=8080 docker-compose up
```

### Using Docker Run

```bash
# Build the image
docker build -t tpm-ui .

# Run with HTTPS backend
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_PROTOCOL=https \
  -e NEXT_PUBLIC_API_HOST=host.docker.internal \
  -e NEXT_PUBLIC_API_PORT=8080 \
  -e NODE_TLS_REJECT_UNAUTHORIZED=0 \
  tpm-ui

# Run with HTTP backend
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_PROTOCOL=http \
  -e NEXT_PUBLIC_API_HOST=host.docker.internal \
  -e NEXT_PUBLIC_API_PORT=9090 \
  tpm-ui
```

## 🔧 Environment Variables

### Backend Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `API_PROTOCOL` | Backend protocol | `https` | `http`, `https` |
| `API_HOST` | Backend hostname | `host.docker.internal` | `localhost`, `192.168.1.100` |
| `API_PORT` | Backend port | `8080` | `9090`, `8443` |
| `WS_PROTOCOL` | WebSocket protocol | `wss` | `ws`, `wss` |

### Next.js Variables (Auto-generated)

These are automatically set by docker-compose from the above variables:

- `NEXT_PUBLIC_API_PROTOCOL`
- `NEXT_PUBLIC_API_HOST` 
- `NEXT_PUBLIC_API_PORT`
- `NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL`
- `NEXT_PUBLIC_WS_CHAT_COMPLETION_URL`

## 🌐 Network Configuration

### Docker Host Access

- **Local development**: Use `localhost` or `127.0.0.1`
- **Docker to host**: Use `host.docker.internal` (Docker Desktop)
- **Docker to Docker**: Use service names or container IPs
- **Remote backend**: Use actual IP address or hostname

### Port Mapping

The UI container exposes port 3000. Map it to your desired host port:

```bash
# UI on port 3000
docker run -p 3000:3000 ...

# UI on port 8000
docker run -p 8000:3000 ...
```

## 🔒 HTTPS and SSL

### Self-Signed Certificates

For development with self-signed certificates:

```bash
docker run -e NODE_TLS_REJECT_UNAUTHORIZED=0 ...
```

### Production SSL

For production, ensure proper SSL certificates are configured on the backend.

## 🚀 Integration with Backend

### Backend Dynamic Console

The backend now shows dynamic URLs based on configuration:

```
📡 BACKEND SERVER STATUS:
   🌐 HTTP Server: http://0.0.0.0:9090
   🔌 WS WebSocket: ws://0.0.0.0:9090/websocket

📋 Quick Copy Commands:
   Backend URL:    http://127.0.0.1:9090
   WebSocket URL:  ws://127.0.0.1:9090/websocket
```

### UI Configuration Detection

The UI automatically detects the backend's JIRA authentication method:

- Fetches `/api/jira/config` to determine if header or body auth is used
- Adapts authentication flow accordingly
- Works seamlessly across HTTP/HTTPS configurations

## 📝 Examples

### Development Scenarios

```bash
# Scenario 1: Local HTTPS backend
API_PROTOCOL=https API_HOST=localhost API_PORT=8080 docker-compose up

# Scenario 2: Local HTTP backend on custom port
API_PROTOCOL=http API_HOST=localhost API_PORT=9090 WS_PROTOCOL=ws docker-compose up

# Scenario 3: Remote backend
API_PROTOCOL=https API_HOST=backend.company.com API_PORT=443 docker-compose up

# Scenario 4: Docker network backend
API_PROTOCOL=http API_HOST=backend-service API_PORT=8080 docker-compose up
```

### Production Deployment

```bash
# Production with environment file
echo "API_PROTOCOL=https" > .env.production
echo "API_HOST=api.yourcompany.com" >> .env.production  
echo "API_PORT=443" >> .env.production
echo "WS_PROTOCOL=wss" >> .env.production

docker-compose --env-file .env.production up -d
```

## 🔍 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if backend is running
   - Verify host and port configuration
   - Use `host.docker.internal` for Docker Desktop

2. **SSL Certificate Errors**
   - Set `NODE_TLS_REJECT_UNAUTHORIZED=0` for development
   - Ensure backend has valid SSL certificates for production

3. **WebSocket Connection Failed**
   - Verify WebSocket protocol matches backend (ws/wss)
   - Check firewall settings for WebSocket ports

4. **CORS Errors**
   - Ensure backend CORS configuration includes UI origin
   - Check if backend allows the UI's host and port

### Debugging

```bash
# Check environment variables in running container
docker exec -it container_name env | grep NEXT_PUBLIC

# View container logs
docker logs container_name

# Test backend connectivity from container
docker exec -it container_name curl -k https://host.docker.internal:8080/health
``` 