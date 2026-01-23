# Backend FIC — ExpressJS + TypeScript + MongoDB

Support service for the FIC project, built with ExpressJS, TypeScript, and MongoDB.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: ExpressJS
- **Language**: TypeScript
- **Database**: MongoDB
- **Error Tracking**: Sentry
- **Payment Gateway**: Xendit

---

## 🚀 Getting Started

### 1. Local Development (No Docker)

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Setup Environment**:
   Create a `.env` file in the root directory (refer to `.env.example` or the section below).

3. **Run in Development Mode**:

   ```bash
   npm run dev
   ```

4. **Build and Start Production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🐳 Docker Usage

You can run the application using either the `Dockerfile` directly or `docker-compose`.

### A. Using Docker Compose (Recommended)

Docker Compose manages both the API and a local MongoDB instance.

| Action               | Command                     |
| :------------------- | :-------------------------- |
| **Build & Run**      | `docker compose up --build` |
| **Run (Detached)**   | `docker compose up -d`      |
| **View Logs**        | `docker compose logs -f`    |
| **Stop**             | `docker compose stop`       |
| **Stop & Remove**    | `docker compose down`       |
| **Stop & Wipe Data** | `docker compose down -v`    |

### B. Using Dockerfile (Standalone)

Use this if you want to build just the API image and connect to an external MongoDB.

1. **Build Image**:

   ```bash
   docker build -t backend-fic .
   ```

2. **Run Container**:

   ```bash
   docker run -p 3000:3000 --env-file .env backend-fic
   ```

3. **Stop Container**:
   Find the container ID and stop it:
   ```bash
   docker ps
   docker stop <container_id>
   ```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=production

# MongoDB
# If using Docker Compose: mongodb://mongo:27017/backend_fic
# If using Local/Atlas: mongodb+srv://...
MONGODB_URI=your_mongodb_uri

# Sentry
SENTRY_DSN=your_sentry_dsn

# Xendit
XENDIT_SECRET_KEY=your_secret_key
XENDIT_WEBHOOK_TOKEN=your_webhook_token

# Admin
ADMIN_BOOTSTRAP_TOKEN=your_token
```

---

## 📂 Project Structure

```text
.
├── src/
│   ├── index.ts        # Entry point
│   ├── config/         # Configuration (DB, etc.)
│   └── ...             # Routes, Controllers, Models
├── dist/               # Compiled TypeScript (ignored)
├── Dockerfile          # Multi-stage build
├── docker-compose.yaml # Service orchestration
└── package.json        # Scripts and dependencies
```

---

## 📋 Available Scripts

- `npm run dev`: Starts the app with `tsc-watch` for development.
- `npm run build`: Compiles TypeScript to `dist/`.
- `npm run start`: Runs the compiled app from `dist/index.js`.
- `npm run type-check`: Runs TypeScript compiler without emitting files.

---

## 🛠 Troubleshooting

### Port Conflicts

If port `3000` is already in use, change `PORT` in `.env` and restart the container.

### MongoDB Connection

- In **Docker Compose**, the API connects to MongoDB using the service name: `mongodb://mongo:27017/backend_fic`.
- If running the API in a container but MongoDB on your **host**, use: `mongodb://host.docker.internal:27017/backend_fic`.

### Clean Reset

If you encounter weird caching issues or want to reset the database:

```bash
docker compose down -v
docker compose up --build
```
