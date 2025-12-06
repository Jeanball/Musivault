# Musivault Deployment Guide

Self-hosting guide for Musivault using Docker and Docker Compose.

> **Note**: Musivault provides pre-built Docker images on GitHub Container Registry. No need to build locally unless you're developing! See [GitHub Container Registry Setup](docs/GHCR.md) for details.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git (to clone the repository)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/musivault.git
cd musivault
```

### 2. Configure Environment Variables

Copy the example environment file and edit it with your settings:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Required configuration:**
- `SESSION_SECRET`: Generate a strong random string
- `DISCOGS_KEY`: Your Discogs API consumer key
- `DISCOGS_SECRET`: Your Discogs API consumer secret

**Optional configuration:**
- `PORT`: Application port (default: 3000)
- `MONGO_URI`: Database connection string (default: local MongoDB)

#### Generate a Session Secret

```bash
openssl rand -base64 32
```

#### Get Discogs API Credentials

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Create a new application
3. Copy your Consumer Key and Consumer Secret

### 3. Launch the Application

**Option A: Using Pre-built Images (Recommended - Faster)**

```bash
docker-compose pull  # Download pre-built images from GitHub Container Registry
docker-compose up -d
```

**Option B: Build Locally (For Development)**

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will:
- Pull necessary Docker images
- Build the frontend and backend containers
- Start MongoDB, backend, and frontend services
- Make the application available at `http://localhost:3000`

### 4. Verify Deployment

Check if all services are running:

```bash
docker-compose ps
```

View logs:

```bash
docker-compose logs -f
```

## Database Options

### Option 1: Local MongoDB (Default)

The docker-compose configuration includes a MongoDB instance. No additional setup required.

**Data persistence:** Database data is stored in a Docker volume named `mongodb_data`.

### Option 2: External MongoDB

If you prefer to use MongoDB Atlas or another hosted MongoDB:

1. Edit `.env` and set your MongoDB connection string:
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/musivault
   ```

2. Comment out or remove the `mongodb` service in `docker-compose.yml`:
   ```yaml
   # mongodb:
   #   image: mongo:7
   #   ...
   ```

3. Remove the MongoDB dependency from the backend service:
   ```yaml
   backend:
     ...
     # depends_on:
     #   mongodb:
     #     condition: service_healthy
   ```

## Management Commands

### Stop the Application

```bash
docker-compose down
```

### Restart Services

```bash
docker-compose restart
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Update the Application

```bash
# Pull latest code
git pull

# Pull latest images and restart
docker-compose pull
docker-compose up -d
```

**For local builds:**
```bash
git pull
docker-compose -f docker-compose.dev.yml up -d --build
```

### Backup Database

```bash
# Export MongoDB data
docker-compose exec mongodb mongodump --db musivault --out /data/backup

# Copy backup to host
docker cp musivault-mongodb:/data/backup ./mongodb-backup
```

### Restore Database

```bash
# Copy backup to container
docker cp ./mongodb-backup musivault-mongodb:/data/backup

# Restore
docker-compose exec mongodb mongorestore --db musivault /data/backup/musivault
```

## Troubleshooting

### Services Won't Start

Check logs for errors:
```bash
docker-compose logs
```

### Database Connection Issues

1. Verify MongoDB is running:
   ```bash
   docker-compose ps mongodb
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Verify `MONGO_URI` in `.env` is correct

### Port Already in Use

Change the port in `.env`:
```
PORT=8080
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

### Cannot Access Application

1. Check if containers are running:
   ```bash
   docker-compose ps
   ```

2. Verify port mapping:
   ```bash
   docker-compose port frontend 80
   ```

3. Check firewall settings on your host

## Production Considerations

### Security

1. **Use strong secrets:** Generate secure random strings for `SESSION_SECRET`
2. **HTTPS:** Use a reverse proxy (nginx, Traefik, Caddy) with SSL certificates
3. **Firewall:** Only expose necessary ports
4. **Updates:** Regularly update Docker images and application code

### Performance

1. **Resources:** Allocate appropriate CPU and memory to containers
2. **Database:** Consider using MongoDB Atlas or managed database for production
3. **Backups:** Implement regular database backup strategy
4. **Monitoring:** Use tools like Prometheus, Grafana for monitoring

### Scaling

For high-traffic scenarios:
- Use external MongoDB (MongoDB Atlas)
- Deploy frontend behind CDN
- Use container orchestration (Kubernetes, Docker Swarm)

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/musivault/issues
- Documentation: https://github.com/yourusername/musivault/wiki
