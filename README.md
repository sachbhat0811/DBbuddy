# DBbuddy 

**DBbuddy** is a premium, real-time diagnostic and administrative dashboard designed specifically for MySQL databases. It acts as an all-in-one control center for Database Administrators (DBAs), DevOps Engineers, and Backend Developers to monitor database health, analyze query performance, resolve concurrency locks, explore schemas, and trigger logical backups—all from a secure, visually stunning glassmorphic web interface.

---

## 🚀 Key Features

*   **Live Process Telemetry:** Monitor real-time active connections, threads, and scan the live `processlist`. Instantly terminate hanging queries with a built-in `KILL` action.
*   **Query Profiling & Index Engineering:** Automatically flag slow queries (>10s window) and visualize MySQL `EXPLAIN` execution plans. Instantly detect high-risk "Full Table Scans" and receive index recommendations.
*   **Infra Vitals & Configuration:** Track QPS (Queries Per Second), Buffer Pool hit ratios, OS-level Host CPU/RAM usage, and view active database configurations (`mysqld.cnf`).
*   **Transactions & Lock Mechanics:** View active transaction locks and trace deadlocks using a Critical Lock Conflicts table that maps the exact Victim vs. Culprit threads.
*   **Schema Explorer & Data Grid:** A dual-layered exploration tool to safely browse database schemas, inspect column data types, and view raw table data securely.
*   **Schema Resilience:** Trigger native OS-level `mysqldump` backups straight to the server volume with advanced flags (Snapshot, No-Data, GZIP), and securely download historical archives.
*   **Replication Dashboard:** Monitor Master-Slave replication integrity and track `Seconds_Behind_Master` lag in real-time.
*   **Cost Realization:** Calculate approximate monthly infrastructure costs and receive resource optimization insights.

---

## 🛠️ Technology Stack

*   **Frontend:** React.js (Vite), Vanilla CSS (Glassmorphism UI), Lucide-React (Icons), Axios.
*   **Backend:** Node.js, Express.js.
*   **Database Integration:** `mysql2` (Connection pooling).
*   **System Integration:** `os-utils` (Host Metrics), native `child_process` (Backup execution).
*   **Security:** Stateless JWT Authentication, Parameterized SQL queries, Secure Blob downloads.

---

## ⚙️ Getting Started (Local Development)

### Prerequisites
*   Node.js (v20+ recommended)
*   MySQL Server (v5.7 or v8.0+)
*   MySQL Client (Required for the Logical Backup feature to function)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/DBbuddy.git
cd DBbuddy
```

### 2. Configure Environment Variables
Create a `.env` file inside the `backend/` directory:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=jusdb_test
JWT_SECRET=super_secure_random_string_here
DASHBOARD_PASSWORD=DASHBOARD123
```

### 3. Install Dependencies
Install packages for both the backend and frontend.
```bash
# Setup Backend
cd backend
npm install

# Setup Frontend
cd ../frontend
npm install
```

### 4. Run the Application
You can run the backend and frontend concurrently for development.

**Terminal 1 (Backend Server):**
```bash
cd backend
node server.js
```

**Terminal 2 (Frontend Vite Server):**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser and log in using the `DASHBOARD_PASSWORD`.

---

## 📦 Production Deployment

For production (e.g., AWS EC2):
1. Build the frontend: `cd frontend && npm run build`
2. The Node.js backend (`server.js`) is designed to natively serve the optimized React bundle from `frontend/dist`. 
3. Run the backend continuously using a process manager like **PM2**: `pm2 start server.js --name DBbuddy`
4. Access the dashboard at `http://<YOUR-SERVER-IP>:5000`.

---

## 🔒 Security Architecture
*   **JWT Protected API:** All backend endpoints (excluding the login route) are strictly protected by a JWT verification middleware.
*   **Anti-SQLi:** Dynamic schema and table name inputs are sanitized using identifier escaping, alongside standard parameterized queries.
*   **Authenticated Downloads:** Database `.sql` backups cannot be downloaded via standard URL guessing. They require an active JWT token passed via Axios blob requests.

---

*Designed for high-performance database management.*
