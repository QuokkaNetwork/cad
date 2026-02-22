const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8090;
const WEB_DIR = __dirname;
const RESOURCE_DIR = path.resolve(__dirname, "..");

const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  let url = req.url.split("?")[0];
  if (url === "/") url = "/index.html";
  let relativePath = url.startsWith("/") ? url.slice(1) : url;

  if (relativePath.includes("..")) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  const baseDir = relativePath.startsWith("tiles/") ? RESOURCE_DIR : WEB_DIR;
  const filePath = path.join(baseDir, relativePath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("Serving on http://localhost:" + PORT));
