/**
 * HW2-style stub client: no mobile UI, just a loop that sends JSON over HTTPS... well, HTTP in dev.
 * Replace BASE_URL when you deploy the API (Render, Railway, Fly.io, EC2, etc.).
 */
const BASE_URL = process.env.API_URL || "http://localhost:3000";
const USER_ID = process.env.USER_ID || "demo-user-1";

/** Roughly Irvine / Orange County for demo. */
let lat = 33.6846;
let lon = -117.8265;

async function register() {
  const r = await fetch(`${BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: USER_ID,
      displayName: "Demo User",
      email: "demo@example.edu",
    }),
  });
  if (!r.ok && r.status !== 409) {
    const t = await r.text();
    throw new Error(`register failed: ${r.status} ${t}`);
  }
}

async function sendLocation() {
  // Tiny random walk to simulate movement
  lat += (Math.random() - 0.5) * 0.002;
  lon += (Math.random() - 0.5) * 0.002;
  const r = await fetch(`${BASE_URL}/api/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_ID, lat, lon }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  console.log(new Date().toISOString(), "location ok", data.received);
}

async function fetchNearby() {
  const q = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radiusKm: "30",
    userId: USER_ID,
  });
  const r = await fetch(`${BASE_URL}/api/nearby?${q}`);
  const data = await r.json();
  console.log("nearby:", data.count, data.nearby);
}

async function main() {
  await register();
  console.log(`Stub client running as ${USER_ID} → ${BASE_URL}`);
  setInterval(async () => {
    try {
      await sendLocation();
      await fetchNearby();
    } catch (e) {
      console.error(e.message);
    }
  }, 4000);
}

main();
