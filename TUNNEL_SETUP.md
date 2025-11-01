# Tunnel Setup Guide

This guide explains how to expose your local development server to the internet with a **stable URL** that doesn't change.

## Quick Start (Recommended)

### Option 1: LocalTunnel (Easiest - Built-in)

Already configured! Just run:

```bash
pnpm install
pnpm run dev:tunnel
```

Your API will be available at: **https://short-video-maker-dev.loca.lt**

> **Note**: The first time you visit, LocalTunnel will show a page asking you to click "Continue". After that, the URL remains stable.

---

## Alternative Options

### Option 2: Cloudflare Tunnel (100% Free, Most Stable)

Cloudflare Tunnel provides completely free, permanent, and stable URLs.

#### Setup:

1. **Install cloudflared:**

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. **Login to Cloudflare:**

   ```bash
   cloudflared tunnel login
   ```

3. **Create a tunnel:**

   ```bash
   cloudflared tunnel create short-video-maker
   ```

4. **Create tunnel config** (`~/.cloudflared/config.yml`):

   ```yaml
   tunnel: <YOUR-TUNNEL-ID>
   credentials-file: /Users/YOUR-USERNAME/.cloudflared/<YOUR-TUNNEL-ID>.json

   ingress:
     - hostname: short-video-maker.yourdomain.com
       service: http://localhost:3123
     - service: http_status:404
   ```

5. **Add DNS record** (via Cloudflare dashboard or CLI):

   ```bash
   cloudflared tunnel route dns short-video-maker short-video-maker.yourdomain.com
   ```

6. **Run the tunnel:**

   ```bash
   # In one terminal
   pnpm run dev

   # In another terminal
   cloudflared tunnel run short-video-maker
   ```

Or create a script to run both together.

**Advantages:**

- ✅ Completely free forever
- ✅ 100% stable URL (never changes)
- ✅ Your own custom domain
- ✅ Built-in DDoS protection
- ✅ No session limits

---

### Option 3: ngrok (Free Tier with Random URL, Paid for Static)

#### Free Tier (Random URL every restart):

```bash
# Install
brew install ngrok

# Run
ngrok http 3123
```

#### Paid Tier (Static Domain):

1. **Sign up** at https://ngrok.com and get your auth token

2. **Configure:**

   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

3. **Reserve a domain** (requires paid plan) in ngrok dashboard

4. **Run with static domain:**
   ```bash
   ngrok http --domain=your-static-domain.ngrok-free.app 3123
   ```

**Free Tier Limitations:**

- ❌ URL changes on every restart
- ✅ No account needed for basic use
- ✅ Easy to set up

**Paid Tier ($8/month):**

- ✅ Permanent static domain
- ✅ More concurrent tunnels
- ✅ Better performance

---

## Recommended Setup for Different Use Cases

| Use Case                    | Recommendation            | Why                                      |
| --------------------------- | ------------------------- | ---------------------------------------- |
| **Quick testing**           | LocalTunnel (built-in)    | Zero setup, works immediately            |
| **Permanent public API**    | Cloudflare Tunnel         | Free forever, 100% stable, custom domain |
| **Professional/Production** | Cloudflare Tunnel         | Free, reliable, secure                   |
| **Temporary demos**         | LocalTunnel or ngrok free | Quick and easy                           |

---

## Customizing LocalTunnel Subdomain

Edit `package.json` to change the subdomain:

```json
{
  "scripts": {
    "tunnel": "lt --port 3123 --subdomain YOUR-CUSTOM-NAME"
  }
}
```

Your URL will be: `https://YOUR-CUSTOM-NAME.loca.lt`

> **Note**: Popular subdomains may be taken. If so, the tunnel will get a random subdomain instead.

---

## Security Considerations

⚠️ **Important**: When exposing your local server to the internet:

1. **Use environment variables** for sensitive data (already done in this project)
2. **Don't expose with default credentials**
3. **Consider adding authentication** to your API endpoints
4. **Monitor access logs** for unusual activity
5. **Use HTTPS** (all tunnel services provide this automatically)

---

## Troubleshooting

### LocalTunnel shows "tunnel server offline"

Try a different subdomain or wait a few minutes.

### Port already in use

Make sure nothing else is running on port 3123:

```bash
lsof -ti:3123 | xargs kill -9
```

### Tunnel connects but API doesn't respond

Ensure your dev server is running (`pnpm run dev`) before starting the tunnel.

---

## Running Both Dev Server and Tunnel

The `dev:tunnel` script runs both automatically:

```bash
pnpm run dev:tunnel
```

This uses `concurrently` to run:

1. Your dev server on port 3123
2. LocalTunnel exposing it to the internet

Check the terminal output for your public URL!

