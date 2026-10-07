// =====================================================
// STEP 1: Paste your OpenWeather API key between the quotes.
// =====================================================
const API_KEY = "9b1fa0cc3c877d6bce0fa4f069467405";

// Keep this false while learning. Set it to true when you run server.js,
// which keeps your key hidden on the server (see server.js).
const USE_PROXY = false;

const PLACEHOLDER = "PASTE_YOUR_API_KEY_HERE";

const WEATHER = {
  clear:  { icon: "☀️", tip: "Great day to be outside. Don't forget sunscreen." },
  cloudy: { icon: "⛅", tip: "Light layers will be fine today." },
  rain:   { icon: "🌧️", tip: "Take an umbrella with you." },
  storm:  { icon: "⛈️", tip: "Stay indoors if you can until it passes." },
  snow:   { icon: "❄️", tip: "Wrap up warm and watch for slippery ground." },
  night:  { icon: "🌙", tip: "A calm evening. A light jacket is enough." }
};

// ---------- Saved settings (unit and recent searches) ----------
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

let unit = load("unit", "metric");        // "metric" = °C, "imperial" = °F
let recent = load("recent", []);
let lastQuery = recent.length ? "q=" + encodeURIComponent(recent[0]) : "q=Accra";

// ---------- Helpers ----------
function themeFor(id, isNight) {
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id === 800) return isNight ? "night" : "clear";
  return "cloudy";
}

function emojiFor(id) {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return "☀️";
  if (id <= 802) return "⛅";
  return "☁️";
}

// Builds the web address for either "weather" (now) or "forecast" (next days).
function apiUrl(endpoint, query) {
  if (USE_PROXY) return "/api/" + endpoint + "?" + query + "&units=" + unit;
  return "https://api.openweathermap.org/data/2.5/" + endpoint + "?" + query +
    "&units=" + unit + "&appid=" + API_KEY;
}

const statusEl = document.getElementById("status");
function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", Boolean(isError));
}

// ---------- Show the current weather ----------
function showWeather(d) {
  const type = themeFor(d.id, d.isNight);
  const label = d.description.charAt(0).toUpperCase() + d.description.slice(1);
  const metric = unit === "metric";
  document.body.dataset.weather = type;
  document.getElementById("icon").textContent = WEATHER[type].icon;
  document.getElementById("condition").textContent = label;
  document.getElementById("tip").textContent = WEATHER[type].tip;
  document.getElementById("city-name").textContent = d.name;
  document.getElementById("temp").textContent = Math.round(d.temp) + (metric ? "°C" : "°F");
  // metric wind comes in m/s, so convert to km/h. imperial is already mph.
  document.getElementById("wind").textContent = Math.round(metric ? d.wind * 3.6 : d.wind);
  document.getElementById("wind-unit").textContent = metric ? "km/h" : "mph";
  document.getElementById("humidity").textContent = Math.round(d.humidity);
  document.getElementById("date").textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  });
}

// ---------- Show the 5-day forecast ----------
function showForecast(data) {
  const list = document.getElementById("forecast");
  const days = {};

  // The forecast comes in 3-hour steps. Group them by the city's local date.
  data.list.forEach((item) => {
    const local = new Date((item.dt + data.city.timezone) * 1000);
    const key = local.toISOString().slice(0, 10);
    const hour = local.getUTCHours();
    if (!days[key]) days[key] = { date: local, temps: [], id: item.weather[0].id, gap: 99 };
    days[key].temps.push(item.main.temp);
    // use the weather closest to midday as the day's icon
    if (Math.abs(hour - 12) < days[key].gap) {
      days[key].gap = Math.abs(hour - 12);
      days[key].id = item.weather[0].id;
    }
  });

  let keys = Object.keys(days).sort();
  if (keys.length > 5) keys = keys.slice(1);   // skip today if we have more than 5 days
  keys = keys.slice(0, 5);

  list.innerHTML = keys.map((k) => {
    const day = days[k];
    const name = day.date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return '<li><span class="d">' + name + '</span>' +
      '<span class="i" aria-hidden="true">' + emojiFor(day.id) + '</span>' +
      '<span class="hi">' + Math.round(Math.max(...day.temps)) + '°</span>' +
      '<span class="lo">' + Math.round(Math.min(...day.temps)) + '°</span></li>';
  }).join("");
}

// ---------- Recent searches ----------
function addRecent(name) {
  recent = [name].concat(recent.filter((n) => n.toLowerCase() !== name.toLowerCase())).slice(0, 5);
  save("recent", recent);
  renderRecent();
}

function renderRecent() {
  const box = document.getElementById("recent");
  box.innerHTML = "";
  recent.forEach((name) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = name;
    chip.addEventListener("click", () => getWeather("q=" + encodeURIComponent(name), name));
    box.appendChild(chip);
  });
}

// ---------- Get the data ----------
// "query" is either "q=CityName" or "lat=..&lon=..".
async function getWeather(query, label) {
  if (!USE_PROXY && API_KEY === PLACEHOLDER) {
    setStatus("Add your OpenWeather API key at the top of weather.js first.", true);
    return;
  }

  setStatus("Loading…");
  try {
    const [res, forecastRes] = await Promise.all([
      fetch(apiUrl("weather", query)),
      fetch(apiUrl("forecast", query))
    ]);

    if (res.status === 404) {
      setStatus(`Couldn't find "${label}". Check the spelling and try again.`, true);
      return;
    }
    if (res.status === 401) {
      setStatus("Your API key isn't working. Check it, or wait a bit if it's brand new.", true);
      return;
    }
    if (!res.ok) throw new Error("Weather request failed");

    const data = await res.json();
    const w = data.weather[0];
    lastQuery = query;

    showWeather({
      name: data.name + (data.sys.country ? ", " + data.sys.country : ""),
      temp: data.main.temp,
      wind: data.wind.speed,
      humidity: data.main.humidity,
      id: w.id,
      description: w.description,
      isNight: w.icon.endsWith("n")
    });

    if (forecastRes.ok) showForecast(await forecastRes.json());
    addRecent(data.name);
    setStatus("");
  } catch (error) {
    setStatus("Couldn't load the weather. Check your internet connection and try again.", true);
  }
}

// ---------- Buttons ----------
document.querySelector(".search").addEventListener("submit", (event) => {
  event.preventDefault();
  const city = document.getElementById("city").value.trim();
  if (city) getWeather("q=" + encodeURIComponent(city), city);
});

document.getElementById("loc").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Your browser doesn't support location.", true);
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => getWeather("lat=" + pos.coords.latitude + "&lon=" + pos.coords.longitude, "your location"),
    () => setStatus("Couldn't get your location. Allow location access and try again.", true)
  );
});

function setUnit(newUnit) {
  unit = newUnit;
  save("unit", unit);
  document.getElementById("unit-c").classList.toggle("is-active", unit === "metric");
  document.getElementById("unit-f").classList.toggle("is-active", unit === "imperial");
  document.getElementById("unit-c").setAttribute("aria-pressed", unit === "metric");
  document.getElementById("unit-f").setAttribute("aria-pressed", unit === "imperial");
}
document.getElementById("unit-c").addEventListener("click", () => { setUnit("metric"); getWeather(lastQuery, "this place"); });
document.getElementById("unit-f").addEventListener("click", () => { setUnit("imperial"); getWeather(lastQuery, "this place"); });

// ---------- Start ----------
setUnit(unit);
renderRecent();
getWeather(lastQuery, "that city");
