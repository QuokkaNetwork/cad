# Desktop Client

Windows Electron wrapper for the CAD web panel.

## Commands
- `npm run dev` - run desktop app in development
- `npm run build` - build Windows NSIS installer

## Server URL
On first launch, the app writes a config file:
- `%APPDATA%/VKC CAD/config.json`

Set `serverUrl` to your hosted CAD endpoint, for example:
```json
{
  "serverUrl": "https://cad.example.com"
}
```

You can also set `CAD_SERVER_URL` as an environment variable before launch/build.
