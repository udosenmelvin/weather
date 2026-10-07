// Optional: keeps your API key hidden. Needs Node.js 18 or newer.
//
// 1. Create a file named .env in this folder containing one line:
//      OPENWEATHER_API_KEY=your_key_here
// 2. In weather.js set:  const USE_PROXY = true;
// 3. Run:  node server.js   then open http://localhost:3000
//
// The browser asks THIS server for weather. The server adds the key and
// talks to OpenWeather, so the key never appears in your page's code.

const http = require("http");
const fs = require("fs");

// Read the key from the .env file (if there is one).
try {
  fs.readFileSync(".env", "utf8").split("\n").forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
} catch (e) {}

const KEY = process.env.OPENWEATHER_API_KEY;
const PORT = process.env.PORT || 3000;

// Only these files can be opened from the browser (so .env stays private).
const FILES = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/style.css": ["style.css", "text/css"],
  "/weather.js": ["weather.js", "text/javascript"]
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/weather" || url.pathname === "/api/forecast") {
    if (!KEY) {
      res.writeHead(500);
      return res.end("Missing OPENWEATHER_API_KEY in .env");
    }
    url.searchParams.delete("appid");
    const target = "https://api.openweathermap.org/data/2.5/" + url.pathname.slice(5) +
      "?" + url.searchParams.toString() + "&appid=" + KEY;
    try {
      const upstream = await fetch(target);
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      return res.end(await upstream.text());
    } catch (e) {
      res.writeHead(502);
      return res.end("Could not reach OpenWeather");
    }
  }

  const file = FILES[url.pathname];
  if (!file) {
    res.writeHead(404);
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": file[1] });
  res.end(fs.readFileSync(file[0]));
}).listen(PORT, () => console.log("Open http://localhost:" + PORT));
