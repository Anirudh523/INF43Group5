import app from "./app.js";

const PORT = process.env.PORT || 3000;
let server;

if (process.env.NODE_V8_COVERAGE) {
  app.post("/__coverage__/shutdown", (_req, res) => {
    res.json({ ok: true });
    setImmediate(() => server.close(() => process.exit(0)));
  });
}

server = app.listen(PORT, () => {
  console.log(`FindMe API listening on http://localhost:${PORT}`);
  console.log("Demo login: alice@example.edu / demo123");
});
