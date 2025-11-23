# Finance Dashboard

This project is a simple frontend dashboard that analyzes CSV export files and shows financial dashboards using Chart.js. It is served via a small Express server which returns CSV file contents at `/data`.

## How to run locally

1. Install dependencies

```powershell
npm install
```

2. Start the server

```powershell
npm start
```

3. Open the dashboard in your browser

Navigate to `http://localhost:3000/Analyse.html`.

Notes:

- The server listens on `process.env.PORT` or `3000` by default.
- The server returns the CSV file contents from the repository root at the `/data` endpoint.
 - The `dashboard.js` server binds to `0.0.0.0` by default so it is reachable from other devices on your LAN. By default, open `http://localhost:3000/Analyse.html` in the same machine's browser. In the terminal you might see `http://0.0.0.0:3000`, which indicates the server is listening on all interfaces — use `http://localhost:3000` or `http://<your-local-ip>:3000` to connect.
 - Debugging: `GET /status` returns a JSON object showing which files are present and their sizes. Useful to troubleshoot missing or unreadable CSV files.
- If you open `Analyse.html` directly via the filesystem (file://), the client will attempt to fetch `http://localhost:3000/data` as a fallback.

## Troubleshooting

- If the browser shows CORS errors when fetching `/data`, ensure the server is started and you are opening the page using `http://localhost:3000/Analyse.html` (same origin as `/data`).
- The server now includes CORS support for development and will return partial data (HTTP 206) if some files fail to load; check the page's `#loadSummary` for details.

## Development

- Start the server in dev mode with `npm run dev` (requires `nodemon`).
- To add more CSV files, modify `files` mapping in `dashboard.js`.

## Security Note

For production deployment, avoid enabling permissive CORS configuration (currently enabled for development). Restrict allowed origins to your production domain.
