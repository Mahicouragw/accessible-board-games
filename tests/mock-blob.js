// Tiny local stand-in for the jsonblob instant-cloud (for offline smoke tests).
// Usage: INSTANT_BLOB_URL=http://localhost:3999 node tests/mock-blob.js
const http = require("http");
let doc = { seq: {}, players: [], scores: [], matches: [], rooms: [], messages: [], roomInvites: [], signals: [], sounds: [], friends: [] };
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(doc));
    } else if (req.method === "PUT") {
      doc = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(doc));
    } else {
      res.writeHead(405); res.end();
    }
  });
});
server.listen(3999, "127.0.0.1", () => console.log("mock blob on :3999"));
