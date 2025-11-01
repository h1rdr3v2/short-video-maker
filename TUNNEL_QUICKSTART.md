# 🌍 Tunnel Setup Complete!

Your dev server can now be exposed to the internet with a **stable URL**.

## 🚀 Quick Start

Just run:

```bash
pnpm run dev:tunnel
```

Your API will be publicly accessible at:
**`https://short-video-maker-dev.loca.lt`**

## 📝 What was added

### New Scripts

- `pnpm run dev:tunnel` - Starts both dev server + tunnel
- `pnpm run tunnel` - Starts only the tunnel (if server already running)

### New Files

- `TUNNEL_SETUP.md` - Complete guide with alternative tunnel options
- `src/scripts/tunnel.js` - Tunnel launcher with nice formatting
- Updated `.env.example` with `TUNNEL_SUBDOMAIN` variable

### New Dependencies

- `localtunnel` - Creates the public tunnel
- `concurrently` - Runs dev server and tunnel together

## 🎯 Usage

### Option 1: Default subdomain

```bash
pnpm run dev:tunnel
```

→ URL: `https://short-video-maker-dev.loca.lt`

### Option 2: Custom subdomain

1. Create/edit `.env` file:

   ```bash
   TUNNEL_SUBDOMAIN=my-custom-name
   ```

2. Run the tunnel:
   ```bash
   pnpm run dev:tunnel
   ```
   → URL: `https://my-custom-name.loca.lt`

## 🔒 First-time security notice

When someone visits your tunnel URL for the first time, LocalTunnel shows a security page:

- This is **normal behavior**
- Click "Click to Continue"
- Bookmark the URL after that
- Won't appear again for the same visitor

## 💡 The URL is stable!

As long as:

- You use the same subdomain
- The subdomain isn't already taken by someone else

The URL will **remain the same** across restarts!

## 🌟 Need even more stability?

See `TUNNEL_SETUP.md` for:

- **Cloudflare Tunnel** (100% free, custom domain, truly permanent)
- **ngrok** (free tier and paid options)
- Comparison of all options

## 🐛 Troubleshooting

**"Subdomain already in use"**
→ Change `TUNNEL_SUBDOMAIN` in `.env` to something unique

**"Connection refused"**
→ Make sure dev server is running first (`pnpm run dev` separately)

**Tunnel shows offline**
→ Wait 30 seconds and try again, or use a different subdomain

## 📚 Documentation

- Local dev: See `CONTRIBUTING.md`
- Tunnel options: See `TUNNEL_SETUP.md`
- Main README: See `README.md`

---

**You're all set!** 🎉

Share your tunnel URL with teammates, clients, or webhook services. They can access your local API as if it were deployed!

