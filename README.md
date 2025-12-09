<p align="center">
  <img src="frontend/public/icons/icon-192x192.png" alt="Musivault Logo" width="120" height="120" style="border-radius: 16px;">
</p>

<h1 align="center">Musivault</h1>

<p align="center">
  <strong>Your music collection, reimagined.</strong><br>
  A beautiful web application to catalog and explore your vinyl & CD collection.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

---

## ✨ Features

- 🎵 **Discogs Integration** - Search and add albums using the Discogs database
- 📊 **Smart Insights** - Collection statistics, format distribution, and top artists
- 🔍 **Advanced Filtering** - Filter by format, decade, or date added
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🌓 **Dark/Light Mode** - Toggle between themes
- 👥 **Multi-user Support** - Each user has their own private collection
- 🔐 **Admin Dashboard** - Manage users with an intuitive admin panel
- 📦 **CSV Import** - Import from Discogs exports
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Discogs API credentials](https://www.discogs.com/settings/developers)

### Installation

```bash
# Clone the repository
git clone https://github.com/Jeanball/musivault.git
cd musivault

# Configure environment
cp .env.example .env
# Edit .env with your SESSION_SECRET, DISCOGS_KEY, and DISCOGS_SECRET

# Start the application
docker compose pull
docker compose up -d
```

Access the app at [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | Session encryption key | ✅ |
| `DISCOGS_KEY` | Discogs API consumer key | ✅ |
| `DISCOGS_SECRET` | Discogs API consumer secret | ✅ |
| `PORT` | Application port (default: 3000) | ❌ |
| `MONGO_URI` | MongoDB connection string | ❌ |
| `ADMIN_EMAIL/USERNAME/PASSWORD` | Initial admin user | ❌ |

Generate a session secret: `openssl rand -base64 32`

## 🛠️ Tech Stack

| Frontend | Backend | Infrastructure |
|----------|---------|----------------|
| React 19 | Node.js + Express | Docker |
| TypeScript | MongoDB + Mongoose | Nginx |
| Vite | JWT Authentication | GitHub Actions |
| TailwindCSS + DaisyUI | | |

## 💻 Development

```bash
# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Run development servers
npm run dev
```

Or with Docker:
```bash
docker compose -f docker-compose.dev.yml up --build
```

## 📦 Docker Images

Pre-built images are available on GitHub Container Registry:

```
ghcr.io/jeanball/musivault/backend:latest
ghcr.io/jeanball/musivault/frontend:latest
```

## 🔧 Management

```bash
docker compose logs -f          # View logs
docker compose restart          # Restart services
docker compose down             # Stop application
docker compose pull && up -d    # Update to latest
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">Made with ❤️ for music collectors</p>
