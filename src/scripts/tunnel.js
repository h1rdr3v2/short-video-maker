#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

// Load .env file if it exists
try {
  require("dotenv").config({ path: path.join(__dirname, "../.env") });
} catch (e) {
  // dotenv might not be available yet, that's okay
}

const subdomain = process.env.TUNNEL_SUBDOMAIN || "short-video-maker-dev";
const port = process.env.PORT || "3123";

console.log(
  "\n╔════════════════════════════════════════════════════════════════╗",
);
console.log(
  "║                  🌍 Starting LocalTunnel                       ║",
);
console.log(
  "╚════════════════════════════════════════════════════════════════╝\n",
);
console.log(`📡 Public URL: https://${subdomain}.loca.lt`);
console.log(`🔌 Local Port: ${port}`);
console.log(`⏳ Waiting for tunnel connection...\n`);
console.log('💡 First-time visitors will see a "Click to Continue" page.');
console.log("   This is normal - just click continue and bookmark the URL!\n");
console.log(
  "────────────────────────────────────────────────────────────────\n",
);

const tunnel = spawn("lt", ["--port", port, "--subdomain", subdomain], {
  stdio: "inherit",
  shell: true,
});

tunnel.on("error", (err) => {
  console.error("\n❌ Error starting tunnel:", err.message);
  console.error("\n💡 Make sure localtunnel is installed: pnpm install\n");
  process.exit(1);
});

tunnel.on("exit", (code) => {
  if (code !== 0) {
    console.error(`\n⚠️  Tunnel exited with code ${code}`);
    console.error(
      "💡 The subdomain might be taken. Try a different one in .env\n",
    );
  }
});

