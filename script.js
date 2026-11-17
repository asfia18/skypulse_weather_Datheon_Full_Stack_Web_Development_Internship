// Option 1: paste your key between the quotes. Option 2: leave it empty and paste it in the page.
const API_KEY = "";

const $ = s => document.querySelector(s);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const BASE = "https://api.openweathermap.org/data/2.5";
const state = { data: null, unit: "C", req: 0 };
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e) {} }
};
const getKey = () => API_KEY || store.get("owmKey") || "";
// The key box only appears when no key is written in the file, so visitors never see it on a finished site.
function showKeybox(){ if (!API_KEY) $("#keybox").hidden = false; }
if (API_KEY) $("#changeKey").hidden = true;
const toUnit = c => Math.round(state.unit === "C" ? c : c * 9 / 5 + 32);
const compass = deg => ["N","NE","E","SE","S","SW","W","NW"][Math.round(deg / 45) % 8];

/* Weather condition id -> background theme */
function skyFor(id, night){
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "fog";
  if (id === 800 || id === 801) return night ? "clear-night" : "clear-day";
  return night ? "clear-night" : "cloudy";
}

/* UI states */
function show(which){
  ["idle","loading","error"].forEach(id => $("#" + id).hidden = id !== which);
  $("#result").hidden = which !== "result";
}
function showError(title, text){ $("#eTitle").textContent = title; $("#eText").textContent = text; show("error"); }

/* Async fetch with timeout and error handling */
async function getJSON(url){
  // Timeout via Promise.race (no AbortSignal, so it also works inside preview windows)
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout")), 10000); });
  try {
    const res = await Promise.race([fetch(url), timeout]);
    if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
    return await res.json();
  } finally { clearTimeout(timer); }
}

/* Provider 1: OpenWeatherMap (needs an API key) */
async function fetchOWM(place, key){
  const where = place.q ? "q=" + encodeURIComponent(place.q) : `lat=${place.lat}&lon=${place.lon}`;
  const qs = `${where}&units=metric&appid=${encodeURIComponent(key)}`;
  const [current, forecast] = await Promise.all([getJSON(`${BASE}/weather?${qs}`), getJSON(`${BASE}/forecast?${qs}`)]);
  return { current, forecast, hourly: forecast.list };
}

/* Provider 2: Open-Meteo (free, no key). Its data is converted to the same shape as OpenWeatherMap's. */
const WMO = c => c === 0 ? [800,"01","clear sky"] : c === 1 ? [801,"02","mainly clear"] : c === 2 ? [802,"03","partly cloudy"]
  : c === 3 ? [804,"04","overcast clouds"] : (c === 45 || c === 48) ? [741,"50","fog"]
  : (c >= 51 && c <= 57) ? [300,"09","drizzle"] : (c >= 61 && c <= 67) ? [500,"10","rain"]
  : (c >= 71 && c <= 77) ? [600,"13","snow"] : (c >= 80 && c <= 82) ? [521,"09","rain showers"]
  : (c === 85 || c === 86) ? [620,"13","snow showers"] : c >= 95 ? [211,"11","thunderstorm"] : [800,"01","clear sky"];
async function fetchMeteo(place){
  let p = place;
  if (place.q) {
    const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place.q)}&count=1&language=en&format=json`);
    if (!g.results || !g.results.length) { const e = new Error("HTTP 404"); e.status = 404; throw e; }
    const r = g.results[0];
    p = { name: r.name, country: r.country_code || "", lat: r.latitude, lon: r.longitude };
  } else p = { name: "Your location", country: "", lat: place.lat, lon: place.lon };
  const q = new URLSearchParams({
    latitude: p.lat, longitude: p.lon, timezone: "auto", forecast_days: 5, wind_speed_unit: "ms",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    hourly: "temperature_2m,weather_code,precipitation_probability"
  });
  const m = await getJSON(`https://api.open-meteo.com/v1/forecast?${q}`);
  const off = m.utc_offset_seconds, c = m.current, [id, ic, desc] = WMO(c.weather_code);
  const current = {
    name: p.name, sys: { country: p.country }, timezone: off, dt: Date.parse(c.time + "Z") / 1000 - off,
    weather: [{ id, icon: ic + (c.is_day ? "d" : "n"), description: desc }],
    main: { temp: c.temperature_2m, feels_like: c.apparent_temperature, humidity: c.relative_humidity_2m, pressure: Math.round(c.pressure_msl) },
    wind: { speed: c.wind_speed_10m, deg: c.wind_direction_10m }
  };
  const list = m.daily.time.map((date, i) => {
    const [fid, fic, fdesc] = WMO(m.daily.weather_code[i]);
    return { dt: Date.parse(date + "T12:00:00Z") / 1000 - off,
      main: { temp_max: m.daily.temperature_2m_max[i], temp_min: m.daily.temperature_2m_min[i] },
      weather: [{ id: fid, icon: fic + "d", description: fdesc }], pop: (m.daily.precipitation_probability_max[i] || 0) / 100 };
  });
  const hourly = m.hourly.time.map((time, i) => {
    const [hid, hic, hdesc] = WMO(m.hourly.weather_code[i]);
    return { dt: Date.parse(time + "Z") / 1000 - off,
      main: { temp: m.hourly.temperature_2m[i] },
      weather: [{ id: hid, icon: hic + "d", description: hdesc }],
      pop: (m.hourly.precipitation_probability[i] || 0) / 100 };
  });
  return { current, forecast: { list }, hourly };
}

async function load(place){
  const key = getKey();
  const id = ++state.req;
  show("loading");
  try {
    if (!navigator.onLine) throw new Error("offline");
    const data = key ? await fetchOWM(place, key) : await fetchMeteo(place);   // key set -> OpenWeatherMap, otherwise Open-Meteo
    if (id !== state.req) return;            // a newer search replaced this one
    state.data = data;
    render();
    if (place.q) store.set("lastCity", place.q);
  } catch (err) {
    if (id !== state.req) return;
    console.error(err);
    if (err.status === 404) showError("City not found", "We couldn't find that place. Check the spelling or try a nearby larger city.");
    else if (err.status === 401) { showKeybox(); showError("API key not accepted", "The key is wrong or not active yet. New OpenWeatherMap keys can take up to a couple of hours to work."); }
    else if (err.status === 429) showError("Too many requests", "The free plan limit was reached. Wait a minute and try again.");
    else if (err.message === "offline") showError("You're offline", "Connect to the internet and try again.");
    else if (err.message === "timeout") showError("Request timed out", "The weather service took too long to respond. Try again.");
    else showError("Couldn't load weather", "The request failed (" + err.message + "). Check your internet connection or turn off ad-blockers, then try again.");
  }
}

/* Render (forecast cards built with Array.map) */
function render(){
  const { current: c, forecast: f } = state.data;
  const tz = c.timezone, w = c.weather[0], night = w.icon.endsWith("n");
  state.sky = skyFor(w.id, night);
  if (!state.auto) applyScene(sceneFor(state.sky), state.sky);   // real weather scene when auto is off
  $("#city").textContent = c.name + (c.sys.country ? ", " + c.sys.country : "");
  $("#when").textContent = new Date((c.dt + tz) * 1000).toLocaleString(undefined, {timeZone:"UTC", weekday:"long", hour:"numeric", minute:"2-digit"}) + " · local time" + (night ? " · night" : "");
  $("#icon").src = `https://openweathermap.org/img/wn/${w.icon}@4x.png`;
  $("#icon").alt = w.description;
  $("#temp").textContent = toUnit(c.main.temp) + "°" + state.unit;
  $("#cond").textContent = w.description;
  $("#feels").textContent = "Feels like " + toUnit(c.main.feels_like) + "°";
  const metricIcons = [
    '<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M3 8h12a3 3 0 1 0-3-3"/><path d="M2 12h17a2.5 2.5 0 1 1-2.5 2.5"/><path d="M4 16h7a2 2 0 1 1-2 2"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M7 4.5 5.5 6"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/></svg>'
  ];
  $("#metrics").innerHTML = [
    ["Humidity", c.main.humidity + "%"],
    ["Wind", Math.round(c.wind.speed * 3.6) + " km/h " + compass(c.wind.deg || 0)],
    ["Pressure", c.main.pressure + " hPa"],
    ["Rain chance", Math.round((f.list[0].pop || 0) * 100) + "%"]
  ].map(([label, value], i) => `<div class="metric"><div class="metric-head"><span class="metric-icon">${metricIcons[i]}</span><span>${label}</span></div><b>${value}</b></div>`).join("");

  const usingOpenMeteo = !getKey();
  $("#hourlyTitle").textContent = usingOpenMeteo ? "Hourly forecast" : "3-hour forecast";
  const hourItems = (state.data.hourly || f.list).filter(item => item.dt >= c.dt).slice(0, 8);
  $("#hours").innerHTML = hourItems.map((item, index) => {
    const timeLabel = index === 0 ? "Now" : new Date((item.dt + tz) * 1000).toLocaleTimeString(undefined, {hour:"numeric", timeZone:"UTC"});
    const wi = item.weather[0];
    const icon = wi.icon.endsWith("n") ? wi.icon.slice(0, -1) + "d" : wi.icon;
    return `<div class="hour"><time>${escapeHTML(timeLabel)}</time><img src="https://openweathermap.org/img/wn/${encodeURIComponent(icon)}@2x.png" alt="${escapeHTML(wi.description)}"><strong>${toUnit(item.main.temp)}°</strong><small>${Math.round((item.pop || 0) * 100)}% rain</small></div>`;
  }).join("");

  // group 3-hourly entries by the city's local date
  const localDate = dt => new Date((dt + tz) * 1000).toISOString().slice(0, 10);
  const hour = dt => new Date((dt + tz) * 1000).getUTCHours();
  const groups = {};
  f.list.forEach(item => (groups[localDate(item.dt)] ||= []).push(item));
  const today = localDate(c.dt);

  $("#days").innerHTML = Object.entries(groups).slice(0, 5).map(([date, items]) => {
    const hi = Math.max(...items.map(i => i.main.temp_max));
    const lo = Math.min(...items.map(i => i.main.temp_min));
    const mid = items.reduce((a, b) => Math.abs(hour(b.dt) - 12) < Math.abs(hour(a.dt) - 12) ? b : a);
    const name = date === today ? "Today" : new Date(date + "T12:00:00Z").toLocaleDateString(undefined, {weekday:"short", timeZone:"UTC"});
    const icon = mid.weather[0].icon.endsWith("n") ? mid.weather[0].icon.slice(0, -1) + "d" : mid.weather[0].icon;
    return `<div class="day"><div class="d">${escapeHTML(name)}</div>
      <img src="https://openweathermap.org/img/wn/${encodeURIComponent(icon)}@2x.png" alt="${escapeHTML(mid.weather[0].description)}">
      <div class="hi">${toUnit(hi)}°</div><div class="lo">${toUnit(lo)}°</div>
      <div class="r">${escapeHTML(mid.weather[0].description)}</div></div>`;
  }).join("");
  show("result");
}

/* Events */
$("#form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#q").value.trim();
  if (!q) return showError("Enter a city", "Type a city name to search, for example Lahore or Tokyo.");
  load({ q });
});
$("#chips").innerHTML = ["Islamabad","Lahore","London","Tokyo","New York"].map(c => `<button type="button">${c}</button>`).join("");
$("#chips").addEventListener("click", e => {
  if (e.target.tagName !== "BUTTON") return;
  $("#q").value = e.target.textContent; load({ q: e.target.textContent });
});
$("#loc").addEventListener("click", () => {
  if (!navigator.geolocation) return showError("Location unavailable", "Your browser doesn't support location. Search by city instead.");
  show("loading");
  navigator.geolocation.getCurrentPosition(
    pos => load({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => showError("Location blocked", "Allow location access in your browser, or search by city name.")
  );
});
function setUnit(u){
  state.unit = u;
  $("#uC").setAttribute("aria-pressed", u === "C"); $("#uF").setAttribute("aria-pressed", u === "F");
  if (state.data) render();
}
$("#uC").addEventListener("click", () => setUnit("C"));
$("#uF").addEventListener("click", () => setUnit("F"));

$("#keyForm").addEventListener("submit", e => {
  e.preventDefault();
  const k = $("#key").value.trim();
  store.set("owmKey", k); $("#keybox").hidden = true; $("#key").value = "";
  load({ q: $("#q").value.trim() || "Islamabad" });
});
$("#changeKey").addEventListener("click", () => { showKeybox(); $("#key").focus(); });

/* Animated background: clouds -> rain -> sunny -> thunder, changing every 3 seconds */
const scene = $("#scene");
scene.querySelector(".clouds").innerHTML = Array.from({length:6}, (_, i) =>
  `<i style="top:${4 + i * 13}%;width:${200 + i * 45}px;animation-duration:${20 + i * 6}s;animation-delay:-${i * 5}s"></i>`).join("");
scene.querySelector(".rain").innerHTML = Array.from({length:70}, () =>
  `<i style="left:${Math.random() * 100}%;animation-duration:${.6 + Math.random() * .6}s;animation-delay:-${Math.random() * 1.2}s"></i>`).join("");
scene.querySelector(".snow").innerHTML = Array.from({length:48}, () =>
  `<i style="left:${Math.random() * 100}%;animation-duration:${5 + Math.random() * 7}s;animation-delay:-${Math.random() * 8}s"></i>`).join("");
const SCENES = [
  ["sunny","clear-day"],
  ["clouds","cloudy"],
  ["rain-clouds","rain"],
  ["rain","rain"],
  ["storm","storm"],
  ["snow","snow"]
];
const sceneFor = sky => ({"clear-day":"sunny", "cloudy":"clouds", "fog":"clouds", "snow":"snow", "rain":"rain", "storm":"storm"})[sky] || "sunny";
function applyScene(name, sky){ scene.dataset.scene = name; document.body.dataset.sky = sky; }
let step = 0, timer = null;
function tick(){ const [name, sky] = SCENES[step++ % SCENES.length]; applyScene(name, sky); }
function setAuto(on){
  state.auto = on; clearInterval(timer);
  $("#auto").setAttribute("aria-pressed", on);
  $("#auto").querySelector("span").textContent = on ? "Scene animation: on" : "Scene animation: off";
  if (on) { tick(); timer = setInterval(tick, 4000); }
  else if (state.sky) applyScene(sceneFor(state.sky), state.sky);
  else applyScene("sunny", "clear-day");
}
$("#auto").addEventListener("click", () => setAuto(!state.auto));
setAuto(!matchMedia("(prefers-reduced-motion: reduce)").matches);

/* Start with the last searched city, or Islamabad */
$("#year").textContent = new Date().getFullYear();
const first = store.get("lastCity") || "Islamabad";
$("#q").value = first;
load({ q: first });
