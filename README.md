# 🚔 CAD System - Computer-Aided Dispatch for FiveM

A modern, full-stack Computer-Aided Dispatch (CAD) system designed for FiveM roleplay servers. Built with real-time capabilities, multi-department support, and seamless in-game integration.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![FiveM](https://img.shields.io/badge/FiveM-Compatible-orange.svg)

## ✨ Features

### 🎯 Core Functionality
- **Real-time Dispatch Board** - Live updates via Server-Sent Events (SSE)
- **Multi-Department Support** - Police, Fire, EMS, and custom departments
- **Priority-Based Call System** - Color-coded P1-P4 priority levels
- **Unit Management** - Track unit status, locations, and assignments
- **In-Game Integration** - Native FiveM resource with NUI interface

### 🚨 Emergency System
- **000/911 Emergency Calls** - In-game popup form with department selection
- **Automatic Priority Assignment** - All emergency calls default to P1 (Urgent)
- **Postal Code Integration** - Automatic location detection and routing
- **GPS Waypoint System** - Automatic waypoint setting for assigned units
- **Live Map** - Real-time unit tracking on an interactive map

### 👮 Law Enforcement Tools
- **Records Management** - Person and vehicle records with BOLO system
- **Warrant System** - Create and manage active warrants
- **Fine Processing** - Automated fine system with QBCore/QBox integration
- **Job Synchronization** - Automatic department assignment via FiveM bridge

### 🔐 Security & Access Control
- **Discord OAuth2 Authentication** - Secure single sign-on
- **Role-Based Permissions** - Granular access control per department
- **Multi-Department Access** - Users can belong to multiple departments
- **Audit Logging** - Comprehensive activity tracking

### 📊 Administration
- **Department Management** - Create and configure departments with custom colors
- **User Management** - Assign roles, departments, and permissions
- **Offense Catalog** - Customizable offense codes and penalties
- **System Settings** - Configure FiveM bridge, Discord webhooks, and more

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Web Client    │◄───────►│   Node.js API    │◄───────►│  SQLite DB      │
│  (React/Vite)   │   HTTP  │  (Express)       │   SQL   │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     ▲
                                     │ HTTP/SSE
                                     ▼
                            ┌──────────────────┐
                            │  FiveM Resource  │
                            │  (Lua + NUI)     │
                            └──────────────────┘
```

**Tech Stack:**
- **Frontend:** React 18, TailwindCSS, React Router
- **Backend:** Node.js 18+, Express.js, SQLite3
- **Real-time:** Server-Sent Events (SSE)
- **Authentication:** Discord OAuth2
- **FiveM:** Lua 5.4, NUI (HTML/CSS/JS)

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- FiveM Server (latest recommended)
- Discord Application (for OAuth2)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/cad-system.git
cd cad-system
```

### 2. Server Setup
```bash
cd server
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=3030
NODE_ENV=production
SESSION_SECRET=your-random-secret-here
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=http://localhost:3030/auth/discord/callback
BASE_URL=http://localhost:3030
```

### 3. Web Client Setup
```bash
cd ../web
npm install

# Create environment file
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3030
```

### 4. Database Initialization
```bash
cd ../server
npm run migrate
```

### 5. FiveM Resource Installation
```bash
# Copy the FiveM resource to your server
cp -r server/fivem-resource [YOUR_FIVEM_SERVER]/resources/cad_bridge

# Add to server.cfg
echo "ensure cad_bridge" >> [YOUR_FIVEM_SERVER]/server.cfg
```

Configure `config.cfg` inside the resource folder:
```ini
cad_bridge_base_url=http://127.0.0.1:3031
cad_bridge_token=your-secure-token-here
cad_bridge_use_nearest_postal=true
cad_bridge_postal_resource=nearest-postal
```

### 6. Start the Application

**Development Mode:**
```bash
# Terminal 1 - API Server
cd server
npm run dev

# Terminal 2 - Web Client
cd web
npm run dev
```

**Production Mode:**
```bash
# Build web client
cd web
npm run build

# Start server (serves API + built web app)
cd ../server
npm start
```

## 🎮 Usage

### First-Time Setup
1. Navigate to `http://localhost:3030`
2. Click "Login with Discord"
3. Authorize the application
4. Configure your first department in Admin > Departments
5. Assign yourself admin permissions in Admin > Users

### For Dispatchers
1. **View Active Calls** - See all incoming emergency calls on the Dispatch Board
2. **Assign Units** - Drag units to calls or use the assign button
3. **Manage Priorities** - Adjust call priority (P1-P4) based on severity
4. **Set Waypoints** - Automatic GPS routing for assigned units
5. **Close Calls** - Mark calls as complete when resolved

### For Units (In-Game)
1. **Go On Duty** - Use the CAD web interface to mark yourself as available
2. **Receive Calls** - Accept assignments from dispatch
3. **Call 000** - Use `/000` command in-game for emergency assistance
   - No arguments: Opens interactive popup form
   - With text: Quick emergency report
4. **View Call Details** - See assigned call information in your CAD panel

### Emergency Call System
**In-Game Usage:**
```
/000                    - Opens popup form with department selection
/000 help              - Shows command help
/test000ui             - Test UI without creating actual call
```

**Popup Form Features:**
- Title field (required, max 80 characters)
- Details field (optional, max 600 characters)
- Department selection (multi-select)
- Automatic location/postal detection
- Clean, theme-matched UI

## 🔧 Configuration

### System Settings (Admin Panel)
- **FiveM Integration** - Bridge token and connection settings
- **Discord Webhooks** - Audit log notifications
- **Department Settings** - Colors, permissions, dispatch roles
- **Job Bindings** - Map CAD departments to FiveM jobs

### FiveM Bridge Configuration
The bridge supports multiple frameworks:
- **QBCore** - Full integration with job sync and fines
- **QBox** - Enhanced integration with improved APIs
- **ESX** - Planned support
- **Standalone** - Works without framework

**Available Adapters:**
- `auto` - Automatic framework detection (recommended)
- `command` - Execute custom commands
- `none` - Disable specific features

### Postal Integration
Works with popular postal scripts:
- nearest-postal
- Custom postal resources (configurable export names)
- Fallback to coordinates if unavailable

## 🎨 Customization

### Theme Colors
All colors follow the CAD color scheme defined in `web/tailwind.config.js`:
```javascript
colors: {
  'cad-bg': '#0a0f1a',
  'cad-surface': '#111827',
  'cad-card': '#1a2332',
  'cad-border': '#2a3a4e',
  'cad-accent': '#0052C2',  // VicPol blue
}
```

### Priority Colors
Calls are color-coded by priority:
- **P1 - Urgent:** Red (#ef4444)
- **P2 - High:** Amber (#f59e0b)
- **P3 - Normal:** Blue (#0052C2)
- **P4 - Low:** Gray (#6b7280)

### Department Colors
Each department has a customizable color displayed on:
- Unit badges
- Call assignments
- Department tags
- Active department indicators

## 📡 API Reference

### Public Endpoints
- `GET /health` - Health check
- `GET /auth/discord` - Discord OAuth2 login
- `GET /auth/discord/callback` - OAuth2 callback

### Authenticated Endpoints
- `GET /api/calls` - List active calls
- `POST /api/calls` - Create new call
- `PATCH /api/calls/:id` - Update call
- `POST /api/calls/:id/assign` - Assign unit to call
- `GET /api/units` - List on-duty units
- `PATCH /api/units/:id/status` - Update unit status
- `GET /api/units/me` - Get current user's unit
- `GET /api/events` - SSE stream for real-time updates

### FiveM Bridge Endpoints
- `POST /api/integration/fivem/heartbeat` - Unit position updates
- `POST /api/integration/fivem/calls` - Create emergency call
- `GET /api/integration/fivem/departments` - List departments
- `GET /api/integration/fivem/job-jobs` - Pending job assignments
- `GET /api/integration/fivem/fine-jobs` - Pending fines

## 🔒 Security

### Authentication Flow
1. User clicks "Login with Discord"
2. Discord OAuth2 authorization
3. User redirected with authorization code
4. Server exchanges code for access token
5. Server retrieves Discord user profile
6. Session created with secure cookie

### Access Control
- **Public Routes:** Login, OAuth callback
- **Authenticated Routes:** All CAD features
- **Admin Routes:** User management, system settings
- **Department Routes:** Restricted by department membership

### Session Management
- HTTP-only secure cookies
- Configurable session duration
- Automatic session refresh
- CSRF protection via SameSite cookies

## 🐛 Troubleshooting

### 000 UI Not Appearing
1. Check F8 console for errors: `[cad_bridge] 000 NUI is ready`
2. Try test command: `/test000ui`
3. Restart resource: `restart cad_bridge`
4. Verify `ui_page` in `fxmanifest.lua`

### Units Not Showing on Map
1. Verify heartbeat in server console
2. Check `Config.HeartbeatIntervalMs` setting
3. Ensure postal script is running (if configured)
4. Verify bridge token matches in config and admin panel

### Discord Login Issues
1. Verify Discord application credentials in `.env`
2. Check redirect URI matches Discord app settings
3. Ensure `BASE_URL` is correctly configured
4. Check server logs for OAuth errors

### Database Errors
1. Ensure migrations ran successfully: `npm run migrate`
2. Check database file permissions
3. Verify SQLite3 native bindings: `npm rebuild sqlite3`

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test changes thoroughly
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the FiveM roleplay community
- Inspired by real-world CAD systems
- Special thanks to all contributors and testers

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/cad-system/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/cad-system/discussions)
- **Discord:** [Join our community](#) (if available)

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Voice integration (Discord voice channels)
- [ ] Advanced analytics dashboard
- [ ] Multi-server support
- [ ] ESX framework integration
- [ ] Automated incident reports
- [ ] Call recording/playback
- [ ] Advanced BOLO system with photos

---

**Made with ❤️ for the FiveM community**
