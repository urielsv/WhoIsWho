# Docker Production Setup with Automatic HTTPS

This guide explains how to deploy the WhoIsWho game with Docker and automatic HTTPS using Caddy.

## Prerequisites

- Docker and Docker Compose installed
- A domain name pointing to your server's IP address
- Ports 80 and 443 open on your firewall

## Quick Start

### 1. Configure Your Domain

Edit the `Caddyfile` and replace `yourdomain.com` with your actual domain:

```caddyfile
yourdomain.com {
    reverse_proxy app:3000
    # ... rest of config
}
```

### 2. Start the Application

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

That's it! Caddy will automatically:
- Obtain SSL certificate from Let's Encrypt
- Renew certificates automatically
- Redirect HTTP to HTTPS
- Handle WebSocket connections for Socket.io

## Configuration

### Environment Variables

You can set environment variables in `docker-compose.yml` under the `app` service:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3000
  - HOSTNAME=0.0.0.0
  - NEXT_PUBLIC_SOCKET_URL=https://yourdomain.com  # Optional
```

### Caddy Configuration

The `Caddyfile` contains all Caddy configuration. Key features:

- **Automatic HTTPS**: Caddy automatically obtains and renews Let's Encrypt certificates
- **WebSocket Support**: Socket.io connections are properly proxied
- **Security Headers**: HSTS, X-Frame-Options, etc. are automatically added
- **Compression**: Gzip and Zstd compression enabled
- **HTTP Redirect**: All HTTP traffic automatically redirects to HTTPS

### Multiple Domains

To support multiple domains, add them to the Caddyfile:

```caddyfile
domain1.com, domain2.com {
    reverse_proxy app:3000
    # ... rest of config
}
```

### Custom Email for Let's Encrypt

By default, Caddy uses a generic email. To set a custom email, add to Caddyfile:

```caddyfile
{
    email your-email@example.com
}

yourdomain.com {
    # ... rest of config
}
```

## Troubleshooting

### View Caddy Logs

```bash
docker-compose logs caddy
```

### View App Logs

```bash
docker-compose logs app
```

### Check Caddy Status

```bash
docker-compose exec caddy caddy version
```

### Validate Caddyfile

```bash
docker-compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Force Certificate Renewal

Caddy automatically renews certificates, but you can force it:

```bash
docker-compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Production Checklist

- [ ] Domain name points to server IP
- [ ] Ports 80 and 443 are open
- [ ] Caddyfile updated with your domain
- [ ] `NEXT_PUBLIC_SOCKET_URL` environment variable set (if needed)
- [ ] Firewall configured
- [ ] Regular backups configured
- [ ] Monitoring set up

## Notes

- The app runs on port 3000 internally
- Caddy handles HTTPS termination on ports 80/443
- Socket.io WebSocket connections are properly proxied
- Certificates auto-renew automatically (no manual intervention needed)
- HTTP automatically redirects to HTTPS
- No need to run separate certbot or nginx containers - Caddy handles everything!

