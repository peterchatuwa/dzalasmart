# Nzeru za Alimi

Server-backed farming system for Malawi. One farmer record, written by the mobile app and by USSD, stored on this machine for now.

[![CI](https://github.com/peterchatuwa/dzalasmart/workflows/CI/badge.svg)](https://github.com/peterchatuwa/dzalasmart/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🌾 **Farmer Management** - Register and track farmers across Malawi
- 📱 **Multi-Channel** - Mobile app and USSD (*413#) support
- 📊 **Season Tracking** - Eight-stage agricultural season events
- 💹 **Market Intelligence** - Live market prices from multiple sources
- 🗺️ **GPS Mapping** - Plot mapping with NDVI satellite data
- 📈 **Plan My Farm** - Season budgets and cash flow planning
- 👨‍🌾 **Extension Services** - Staff desk for agricultural officers
- 🏪 **Warehouse Receipts** - Asset-backed lending for harvest storage
- 🌤️ **Weather Integration** - District-level alerts and forecasts
- 💬 **AI Advisory** - Multilingual crop advice (English, Chichewa, Tumbuka)

## Quick Start

### Prerequisites

- Node.js 22+ (required)
- PostgreSQL 16+ (recommended for production)
- Docker & Docker Compose (optional, for containerized development)

### Local Development

```bash
# Clone the repository
git clone https://github.com/peterchatuwa/dzalasmart.git
cd dzalasmart

# Install dependencies
npm install

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL (or omit for in-memory dev DB)

# Run the server
npm start
```

The API will be available at:

- **Farmer App**: http://localhost:4000
- **Staff Desk**: http://localhost:4000/staff
- **API Docs**: http://localhost:4000/api-docs
- **Health Check**: http://localhost:4000/health

### Docker Development

```bash
# Start all services (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Demo Accounts

### Farmers (PIN: 1234)

| Name          | Phone         | Season              |
| ------------- | ------------- | ------------------- |
| Grace Banda   | +265888000001 | at Harvest          |
| Joseph Kaunda | +265888000002 | at Land Preparation |
| Estere Mvula  | +265888000003 | not started         |

### Staff (PIN: 1234)

| Name          | Phone         | Role                    |
| ------------- | ------------- | ----------------------- |
| Mercy Chirwa  | +265888000101 | Extension Officer       |
| Joseph Phiri  | +265888000102 | Cooperative Manager     |
| Chikondi Moyo | +265888000103 | Ministry of Agriculture |
| Davis Mwale   | +265888000104 | Farmers Union           |

## API Documentation

Full API documentation is available via Swagger UI:

- **Interactive Docs**: http://localhost:4000/api-docs
- **OpenAPI JSON**: http://localhost:4000/api-docs.json

### Key Endpoints

| Method | Path                     | Description              |
| ------ | ------------------------ | ------------------------ |
| `POST` | `/api/farmers/register`  | Register a new farmer    |
| `POST` | `/api/farmers/login`     | Farmer authentication    |
| `GET`  | `/api/farmers/me/status` | Get farmer season status |
| `POST` | `/api/farmers/me/events` | Log a season event       |
| `GET`  | `/api/market/prices`     | Live market prices       |
| `GET`  | `/api/market/trends`     | Price trends & charts    |
| `POST` | `/ussd`                  | USSD channel endpoint    |
| `GET`  | `/health`                | Health check             |
| `GET`  | `/metrics`               | System metrics           |

## Android App

The farmer UI is wrapped with Capacitor for Android.

```bash
# Sync web assets to Android
npm run android:sync

# Open in Android Studio
npm run android:open

# Build APK in Android Studio
```

The app defaults to `http://10.0.2.2:4000` for emulators. On physical devices, set your PC's LAN IP in the server field.

## Database

### PostgreSQL Setup

```bash
# Create database and user
createuser -P nzeru
createdb -O nzeru nzeru

# Set connection in server/.env
DATABASE_URL=postgres://nzeru:yourpassword@localhost:5432/nzeru
```

### Migrations

```bash
# Run pending migrations
npm run migrate

# Create a new migration
npm run migrate:create -- add_new_feature
```

### Migration from SQLite

If you have an old SQLite database:

```bash
DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-pg.js
```

## Deployment

### Production (Docker)

```bash
# Copy and configure environment
cp .env.docker.example .env.docker
# Edit .env.docker with production secrets

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml --env-file .env.docker up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Manual Deployment

See `scripts/deploy_remote.py` for VPS deployment or refer to [CONTRIBUTING.md](CONTRIBUTING.md) for detailed deployment instructions.

**Security Checklist:**

- ✅ Change `JWT_SECRET` to a strong random string (32+ chars)
- ✅ Use strong PostgreSQL password
- ✅ Enable HTTPS with nginx/Caddy reverse proxy
- ✅ Configure firewall rules
- ✅ Set `NODE_ENV=production`
- ✅ Review [SECURITY.md](SECURITY.md)

## Architecture

```
dzalasmart/
├── server/              # Backend API & business logic
│   ├── src/
│   │   ├── app.js       # Express application
│   │   ├── db.js        # PostgreSQL database layer
│   │   ├── farmers.js   # Farmer management
│   │   ├── market/      # Market intelligence
│   │   ├── middleware/  # Security, logging, monitoring
│   │   └── swagger/     # API documentation
│   ├── test/            # Test suite
│   ├── migrations/      # Database migrations
│   └── scripts/         # Utility scripts
├── frontend/            # Web UI (vanilla JS)
├── android/             # Capacitor Android wrapper
├── .github/             # CI/CD workflows
└── docker-compose.yml   # Local development setup
```

## Technology Stack

**Backend:**

- Node.js 22 + Express 5
- PostgreSQL 16
- JWT authentication
- Pino structured logging
- Helmet security headers
- Rate limiting

**Frontend:**

- Vanilla JavaScript
- OpenStreetMap integration
- Capacitor for mobile

**DevOps:**

- Docker & Docker Compose
- GitHub Actions CI/CD
- ESLint + Prettier
- Husky pre-commit hooks

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Code style guidelines
- Testing requirements
- Pull request process

## Security

For security issues, please see [SECURITY.md](SECURITY.md) for responsible disclosure procedures.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and changes.

## Support

- **Issues**: [GitHub Issues](https://github.com/peterchatuwa/dzalasmart/issues)
- **Discussions**: [GitHub Discussions](https://github.com/peterchatuwa/dzalasmart/discussions)
- **Email**: See [SECURITY.md](SECURITY.md) for security contact

## Acknowledgments

Built for Malawian farmers with support from agricultural extension services, cooperatives, and the Ministry of Agriculture.

---

**Nzeru za Alimi** - "Farming Wisdom" in Chichewa 🌾
