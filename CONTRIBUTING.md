# Contributing to Shorts Creator

## How to setup the development environment

1. Clone the repository

   ```bash
   git clone git@github.com:gyoridavid/short-video-maker.git
   cd shorts-video-maker
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env` and set the right environment variables.

4. Start the server
   ```bash
   pnpm dev
   ```

## Exposing your local server to the internet (Tunneling)

If you want others to access your development server with a **stable URL that doesn't change**, you can use the built-in tunnel support:

### Quick Start

```bash
pnpm run dev:tunnel
```

This will:

- Start your dev server on `localhost:3123`
- Create a public tunnel at `https://short-video-maker-dev.loca.lt`

The first time visitors access the URL, LocalTunnel will show a "Click to Continue" page. This is normal security behavior - just click continue and bookmark the URL.

### Customizing the tunnel subdomain

Edit your `.env` file:

```bash
TUNNEL_SUBDOMAIN=your-custom-name
```

Your URL will be: `https://your-custom-name.loca.lt`

### Alternative tunnel options

For more stable, production-ready tunneling (100% free with custom domains), see [TUNNEL_SETUP.md](TUNNEL_SETUP.md) for:

- Cloudflare Tunnel (recommended for permanent public access)
- ngrok (both free and paid tiers)
- Detailed setup instructions and comparisons

## How to preview the videos and debug the rendering process

You can use Remotion Studio to preview videos. Make sure to update the template if the underlying data structure changes.

```bash
npx remotion studio
```
