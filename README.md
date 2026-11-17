# SkyPulse Weather

SkyPulse Weather is a responsive weather dashboard built with HTML, CSS and vanilla JavaScript. It lets you look up weather conditions for cities around the world and view current conditions alongside hourly and five-day forecasts.

The project is intentionally kept lightweight: there is no framework, build step or package installation required.

## What it includes

- Search for cities using the Open-Meteo geocoding service.
- View current temperature, feels-like temperature, humidity, wind speed and direction, atmospheric pressure, and precipitation probability.
- Browse an hourly forecast in a horizontally scrollable strip.
- Check daily high and low temperatures in the five-day forecast.
- Switch between Celsius and Fahrenheit.
- Use the browser's location feature to check nearby weather (with permission).
- View animated background scenes, with an option to turn the ambient animation off.
- Use the default Open-Meteo service without an API key, or optionally enter an OpenWeatherMap API key.
- Responsive layout for desktop, tablet and mobile screens.
- Loading, offline, timeout, invalid-city and API error states.

## Built with

- **HTML5** for the page structure
- **CSS3** for layout, responsive styling, glass-style panels and weather effects
- **Vanilla JavaScript** for application logic, asynchronous requests and rendering
- **Open-Meteo Geocoding API** for city lookup
- **Open-Meteo Forecast API** for current, hourly and daily weather data
- **OpenWeatherMap API** as an optional alternative provider

## Getting started

You do not need to install dependencies.

1. Download or clone this repository.
2. Open the project folder.
3. Open `index.html` in a modern browser.

For local development, running a small web server is recommended:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Weather data

### Open-Meteo (default)

The app uses Open-Meteo by default. No API key is required.

- Geocoding: https://geocoding-api.open-meteo.com/
- Forecast API: https://open-meteo.com/

### OpenWeatherMap (optional)

An OpenWeatherMap API key can be entered through **API settings** in the footer. The key is stored in the browser's local storage on that device.

You can also set the `API_KEY` constant near the beginning of `script.js`, but do not commit a personal API key to a public repository. A key entered in the browser is still visible to that browser's user, so this option is intended for personal testing rather than a production secret-management solution.

OpenWeatherMap's free forecast endpoint returns data at three-hour intervals. When this provider is active, the dashboard labels that section as a **3-hour forecast**. Open-Meteo supplies hourly forecast data.

## Project files

```text
skypulse-weather/
├── index.html       # Page structure and content
├── styles.css       # Responsive design and visual styling
├── script.js        # Weather requests, state and UI rendering
└── README.md        # Project documentation
```

## Notes and limitations

- The animated background is an ambient visual effect. It runs through a repeating sequence and is separate from the live forecast data.
- Forecast information depends on the selected provider and an active internet connection.
- Browser geolocation generally requires HTTPS or localhost, and the visitor must allow location access.
- City search uses the first matching result returned by the geocoding service. If a city name is shared by multiple places, adding a country or region can help narrow the search.
- Weather icons are loaded from OpenWeatherMap's icon service.
- The app respects the browser's reduced-motion preference.

## Deployment

This is a static website and can be hosted on services such as GitHub Pages, Netlify or Vercel. Upload the project files while keeping them in the same folder structure.

## License

No open-source license has been added yet. Unless a license is included, the project should be treated as all rights reserved by its author.
