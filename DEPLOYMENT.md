# TPM Frontend Deployment Configuration

This guide shows how to configure the frontend for different deployment scenarios.

## 🔧 Configuration Overview

The frontend now supports flexible backend URL configuration through environment variables:

- **`NEXT_PUBLIC_API_HOST`** - Backend hostname (e.g., `localhost`, `api.company.com`)
- **`NEXT_PUBLIC_API_PROTOCOL`** - Protocol (`http` or `https`)  
- **`NEXT_PUBLIC_API_PORT`** - Backend port (e.g., `8080`, `443`)
- **`INTERNAL_API_HOST`** - Internal hostname for server-side calls

## 🚀 Deployment Scenarios

### Local Development (Docker)
```bash
# For Docker Compose development
export NEXT_PUBLIC_API_HOST=localhost
export NEXT_PUBLIC_API_PROTOCOL=https  
export NEXT_PUBLIC_API_PORT=8080
export INTERNAL_API_HOST=backend
export NODE_TLS_REJECT_UNAUTHORIZED=0

docker-compose up --build
```

### Local Development (Native)
```bash
# When running frontend and backend natively
export NEXT_PUBLIC_API_HOST=localhost
export NEXT_PUBLIC_API_PROTOCOL=https
export NEXT_PUBLIC_API_PORT=8080  
export INTERNAL_API_HOST=localhost
export NODE_TLS_REJECT_UNAUTHORIZED=0

npm run dev
```

### Staging Deployment
```bash
# For staging environment
export NEXT_PUBLIC_API_HOST=staging-api.yourcompany.com
export NEXT_PUBLIC_API_PROTOCOL=https
export NEXT_PUBLIC_API_PORT=443
export INTERNAL_API_HOST=staging-api.yourcompany.com
export NODE_TLS_REJECT_UNAUTHORIZED=1

docker build -t frontend:staging .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_HOST=staging-api.yourcompany.com \
  -e NEXT_PUBLIC_API_PROTOCOL=https \
  -e NEXT_PUBLIC_API_PORT=443 \
  frontend:staging
```

### Production Deployment  
```bash
# For production environment
export NEXT_PUBLIC_API_HOST=api.yourcompany.com
export NEXT_PUBLIC_API_PROTOCOL=https
export NEXT_PUBLIC_API_PORT=443
export INTERNAL_API_HOST=api.yourcompany.com
export NODE_TLS_REJECT_UNAUTHORIZED=1

docker build -t frontend:prod .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_HOST=api.yourcompany.com \
  -e NEXT_PUBLIC_API_PROTOCOL=https \
  -e NEXT_PUBLIC_API_PORT=443 \
  frontend:prod
```

## 🔑 Key Benefits

✅ **No hardcoded URLs** - Fully configurable via environment variables  
✅ **Environment-specific** - Different configs for dev/staging/prod  
✅ **Container-friendly** - Works with Docker, Kubernetes, etc.  
✅ **CI/CD ready** - Easy to automate deployments  

## 🛠️ How It Works

1. **Browser calls** use `NEXT_PUBLIC_*` variables (visible to client)
2. **Server-side calls** use `INTERNAL_*` variables (server-only)
3. **Automatic switching** between internal/external URLs based on context

This setup allows the same Docker image to work in any environment by just changing environment variables! 