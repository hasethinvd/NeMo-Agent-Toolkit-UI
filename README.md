# AIQ Toolkit - UI

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![AIQ Toolkit](https://img.shields.io/badge/AIQ Toolkit-Frontend-green)](https://github.com/NVIDIA/AIQ Toolkit)

This is the official frontend user interface component for [AIQ Toolkit](https://github.com/NVIDIA/AIQ Toolkit), an open-source library for building AI agents and workflows.

This project builds upon the work of:
- [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) by Mckay Wrigley
- [chatbot-ollama](https://github.com/ivanfioravanti/chatbot-ollama) by Ivan Fioravanti

## Features
- 🎨 Modern and responsive user interface
- 🔄 Real-time streaming responses
- 🤝 Human-in-the-loop workflow support
- 🌙 Light/Dark theme
- 🔌 WebSocket and HTTP API integration
- 🐳 Docker support
- 🔒 **Enterprise Security Features**
- 🛡️ **HTTPS/SSL Support with Auto-Generated Certificates**
- 🔐 **Multi-Factor Authentication (MFA)**
- 📊 **Security Audit Logging**
- 🚦 **Rate Limiting & DDoS Protection**

## Security & HTTPS Features

### 🔒 HTTPS/SSL Support
The UI now includes comprehensive HTTPS support with automatic SSL certificate generation:

- **Automatic Certificate Generation**: Self-signed certificates are automatically created and managed
- **Custom Certificate Support**: Supports custom SSL certificates for production environments
- **Multi-Platform Certificate Installation**: Automatic certificate installation helpers for macOS, Linux, and Windows
- **SSL Context Management**: Secure communication with backend APIs using custom HTTPS fetch utilities

### 🔐 Multi-Factor Authentication (MFA)
Enterprise-grade MFA integration with the backend:

- **TOTP-Based Authentication**: Compatible with Google Authenticator, Authy, and other TOTP apps
- **Backup Codes**: Secure backup codes for account recovery
- **Session Management**: Secure session validation and cleanup
- **Real-time Status**: Live MFA status monitoring and setup guidance

### 🛡️ Security Architecture
The UI implements several security utilities for secure API communication:

**`utils/app/api-config.ts`**
- Dynamic API URL construction with protocol detection
- Environment-based configuration for different deployment scenarios
- Secure endpoint management

**`utils/app/https-fetch.ts`**
- Custom HTTPS fetch implementation for self-signed certificates
- Automatic SSL certificate validation bypass for localhost development
- Server-side and client-side request handling

### 🚦 Rate Limiting & Security
- **Client IP Tracking**: Automatic client IP detection for security logging
- **Request Rate Limiting**: Protection against brute force attacks
- **Security Event Logging**: Comprehensive audit trail for all security events
- **Session Validation**: Secure session management with automatic cleanup

## Getting Started

### Prerequisites
- [AIQ Toolkit](https://github.com/NVIDIA/AIQ Toolkit) installed and configured
- Git
- Node.js (v18 or higher)
- npm or Docker

### Installation

Clone the repository:
```bash
git clone git@github.com:NVIDIA/AIQ Toolkit-UI.git
cd AIQ Toolkit-UI
```

Install dependencies:
```bash
npm ci
```

### Running the Application

#### HTTPS Development (Recommended)
For secure development with HTTPS enabled:

1. **Start Backend with HTTPS**:
```bash
cd ../configs
aiq serve --config_file config.yml --port 8080
```
This automatically generates SSL certificates and runs on `https://localhost:8080`

2. **Start UI**:
```bash
npm run dev:https
```

3. **Certificate Installation** (First Time):
   - macOS: Certificate will be automatically added to Keychain
   - Linux/Windows: Follow the certificate installation prompts
   - Browser: Accept the certificate when prompted

#### Local Development (HTTP)
```bash
npm run dev:http
```
The application will be available at `http://localhost:3000`

#### Available Development Scripts
- `npm run dev:https` - HTTPS development with self-signed certificate support
- `npm run dev:http` - HTTP development (no SSL)
- `npm run dev:prod-ssl` - HTTPS using production SSL certificates 
- `npm run dev:flexible` - Flexible configuration using environment variables

#### Docker Deployment
```bash
# Build the Docker image
docker build -t AIQ Toolkit-UI .

# Run the container with environment variables from .env
# Ensure the .env file is present before running this command.
# Skip --env-file .env if no overrides are needed.
docker run --env-file .env -p 3000:3000 AIQ Toolkit-UI
```

![AIQ Toolkit Web User Interface](public/screenshots/ui_home_page.png)

## Configuration

### HTTPS & Security Configuration

#### Environment Variables (Optional)
**No environment variables needed!** The npm scripts (`npm run dev:https`, `npm run dev:http`) handle all configuration automatically.

Override defaults only if needed:

```bash
# API Configuration (npm scripts set these automatically)
NEXT_PUBLIC_API_PROTOCOL=https          # Default: 'https'
NEXT_PUBLIC_API_HOST=127.0.0.1          # Default: 'localhost'  
NEXT_PUBLIC_API_PORT=8080              # Default: '8080'

# Advanced Configuration (handled by npm scripts)
NODE_TLS_REJECT_UNAUTHORIZED=0          # Accept self-signed certificates
NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON=true  # Enable WebSocket by default
```

#### Backend SSL Configuration
The UI automatically detects and adapts to backend SSL configuration:

```yaml
# Backend config.yml
general:
  front_end:
    ssl_cert_file: "../certs/prod.crt"
    ssl_key_file: "../certs/prod.key" 
    ssl_ca_file: "../certs/ca.crt"
    ssl_auto_generate: true
    cors:
      allow_origins: ["https://localhost:3000", "https://127.0.0.1:3000"]
      allow_credentials: true
```

### HTTP API Connection
Settings can be configured by selecting the `Settings` icon located on the bottom left corner of the home page.

![AIQ Toolkit Web UI Settings](public/screenshots/ui_generate_example_settings.png)

### Settings Options
NOTE: Most of the time, you will want to select /chat/stream for intermediate results streaming.

- `Theme`: Light or Dark Theme
- `HTTP / HTTPS URL for Chat Completion`: REST API endpoint
  - /generate - Single response generation
  - /generate/stream - Streaming response generation
  - /chat - Single response chat completion
  - /chat/stream - Streaming chat completion
- `WebSocket URL for Completion`: WebSocket URL to connect to running AIQ Toolkit server
- `WebSocket Schema`: Workflow schema type over WebSocket connection

### 🔐 MFA Setup
When JIRA credentials are configured, MFA is automatically set up:

1. **Automatic Setup**: MFA is initialized when you save JIRA credentials
2. **QR Code Generation**: Scan the QR code with your authenticator app
3. **Backup Codes**: Save the provided backup codes securely
4. **Verification**: Enter TOTP code to complete setup

## Security Best Practices

### For Development
- Use HTTPS even in development environments
- Install SSL certificates in your browser's trust store
- Enable MFA for all JIRA-connected operations
- Monitor security logs for unusual activity

### For Production
- Use valid SSL certificates from a trusted CA
- Configure proper CORS origins in backend config
- Enable rate limiting and audit logging
- Regularly rotate MFA backup codes
- Implement proper session management

### Certificate Management
- Certificates are automatically generated with 365-day validity
- Use the provided certificate installation helpers
- Monitor certificate expiration dates
- Consider using Let's Encrypt for production deployments

## Usage Examples

### Simple Calculator Example

#### Setup and Configuration
1. Set up [AIQ Toolkit](https://github.com/NVIDIA/AIQ Toolkit/blob/main/docs/source/1_intro/getting_started.md) 
2. Start workflow by following the [Simple Calculator Example](https://github.com/NVIDIA/AIQ Toolkit/blob/main/examples/simple_calculator/README.md)
```bash
aiq serve --config_file=examples/simple_calculator/configs/config.yml
```

#### Testing the Calculator
Interact with the chat interface by prompting the agent with the message:
```
Is 4 + 4 greater than the current hour of the day?
```

![AIQ Toolkit Web UI Workflow Result](public/screenshots/ui_generate_example.png)

### Human In The Loop (HITL) Example

#### Setup and Configuration
1. Set up [AIQ Toolkit](https://github.com/NVIDIA/AIQ Toolkit/blob/main/docs/source/1_intro/getting_started.md) 
2. Start workflow by following the [HITL Example](https://github.com/NVIDIA/AIQ Toolkit/blob/main/examples/simple_human_in_the_loop/README.md)
```bash
aiq serve --config_file=examples/simple_human_in_the_loop/configs/config.yml
```

#### Configuring HITL Settings
Enable WebSocket mode in the settings panel for bidirectional real-time communication between the client and server.

![AIQ Toolkit Web UI HITL Settings](public/screenshots/hitl_settings.png)

#### Example Conversation
1. Send the following prompt:
```
Can you process my input and display the result for the given prompt: How are you today?
```

2. Enter your response when prompted:

![AIQ Toolkit Web UI HITL Prompt](public/screenshots/hitl_prompt.png)

3. Monitor the result:

![AIQ Toolkit Web UI HITL Prompt](public/screenshots/hitl_result.png)

## API Integration

### Server Communication
The UI supports both HTTP requests (OpenAI compatible) and WebSocket connections for server communication. For detailed information about WebSocket messaging integration, please refer to the [WebSocket Documentation](https://github.com/NVIDIA/AIQ Toolkit/blob/main/docs/5_advanced/websockets.md) in the AIQ Toolkit documentation.

### Secure API Communication
The UI includes specialized utilities for secure communication:

- **`httpsFetch()`**: Custom fetch implementation for HTTPS with self-signed certificates
- **`getApiUrl()`**: Dynamic API URL construction with protocol detection
- **Session Management**: Automatic MFA session validation and renewal
- **Error Handling**: Comprehensive error handling for security-related failures

## Troubleshooting

### HTTPS Certificate Issues
```bash
# Check certificate status
openssl x509 -in certs/prod.crt -text -noout

# Regenerate certificates
rm -rf certs/
aiq serve --config_file config.yml  # Will auto-generate new certificates
```

### MFA Issues
- **Invalid TOTP Code**: Check your device's time synchronization
- **Backup Code Not Working**: Ensure you're using an unused backup code
- **Session Expired**: Re-authenticate using your TOTP app

### API Connection Issues
- **CORS Errors**: Check `allow_origins` in backend config
- **SSL Handshake Failed**: Install the CA certificate in your browser
- **Rate Limited**: Wait for rate limit to reset or check IP address

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. The project includes code from [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) and [chatbot-ollama](https://github.com/ivanfioravanti/chatbot-ollama), which are also MIT licensed.

