# 🏥 MediLink AI — Intelligent Inter-Hospital Medicine Redistribution Network

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18-lightgrey.svg)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas%20Cloud-green.svg)](https://www.mongodb.com/cloud/atlas)
[![Ollama GLM-4](https://img.shields.io/badge/AI%20Engine-GLM--4%20Local-blue.svg)](https://ollama.ai/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

MediLink AI is a zero-stockout, game-theoretic healthcare logistics platform designed to autonomously predict ICU medicine stockouts, match regional surplus across hospitals via an interactive GIS corridor map, and coordinate emergency dispatches with live GPS fleet telemetry.

---

## 📑 Table of Contents
- [✨ Core Features](#-core-features)
- [🏗️ Network Architecture](#️-network-architecture)
- [📋 Prerequisites](#-prerequisites)
- [🚀 Quick Start (Local Setup)](#-quick-start-local-setup)
- [🧠 Setting Up Local GLM-4 AI (Ollama)](#-setting-up-local-glm-4-ai-ollama)
- [🍃 Setting Up Your MongoDB Atlas Database](#-setting-up-your-mongodb-atlas-database)
- [🐳 Running with Docker / Docker Compose](#-running-with-docker--docker-compose)
- [👥 Role Login Matrix & Demo Accounts](#-role-login-matrix--demo-accounts)
- [📡 API & Hardware Endpoints](#-api--hardware-endpoints)

---

## ✨ Core Features

1. **🏥 Autonomous Bi-Directional Hospital Nodes (`H01`, `H02`, `H03`)**:
   - Every connected hospital acts as both a **Requester** and a **Donor** facility.
   - Real-time stock tracking across pharmaceutical dosage forms: **Strips, Bottles (100ml/200ml), Vials (10ml), Ampoules, Tubes (20g), Boxes, and Gross kg**.

2. **🧠 AI Time-Traveler Depletion Forecasting (GLM-4 Local LLM)**:
   - Analyzes real-time ICU burn rates and predicts zero-stock stockout events **5 hours in advance**.
   - GLM-4 Local AI provides deep clinical rationale explaining why emergency sourcing is necessary.

3. **🗺️ Interactive Regional GIS Proximity Sourcing Map**:
   - Embedded Leaflet/OpenStreetMap engine mapping real hospital GPS coordinates across Karnataka & South India.
   - Dynamic highway distance calculations, travel ETAs, and glowing emergency transit corridors.

4. **🚨 Real-Time SSE Notification Center & Siren Alerts**:
   - Server-Sent Events (SSE) telemetry pipeline broadcasting immediate siren banners, browser Web Audio alert chimes (`D5 ➔ A5`), and top-right pop-up toast alerts.

5. **🚑 Two-Way Driver Coordination & Live GPS Fleet Telemetry**:
   - Supports two dispatch modes:
     - **Requester Driver**: Requester's ambulance dispatches to pick up medicine.
     - **Sender Driver Required**: Donor hospital coordinates emergency express logistics.
   - Real-time automated GPS movement, speed telemetry (`58 km/h`), cold-chain thermal monitoring (`3.8°C Safe`), and 1-click Direct Call & WhatsApp contact cards.

6. **🔒 Dual-Physical Verification Workstation (Pharmacist)**:
   - Dual-lock optical barcode scanning + RFID tag validation + digital load-cell tare weight check before dispatch.

7. **🏆 Game-Theoretic Karma Reputation Market**:
   - Dynamic incentive ledger awarding **+10 to +25 Karma** for rapid life-saving donations, ensuring priority queue access during regional medicine shortages.

---

## 🏗️ Network Architecture

```
                               ┌────────────────────────────────────────────────┐
                               │       Central Factory Warehouse (DC)           │
                               │  - GS1 Smart QR Serialization                  │
                               │  - Pallet Batch Consignment Outflow            │
                               └───────────────────────┬────────────────────────┘
                                                       │
                           ┌───────────────────────────┴───────────────────────────┐
                           │                                                       │
                           ▼                                                       ▼
            ┌──────────────────────────────┐                       ┌──────────────────────────────┐
            │    Node H01: Apollo Mysore   │ ◄─── Highway Corridor ──► │ Node H02: Bangalore Medical  │
            │  - Local Pharmacy Inventory  │     (Live GPS Telemetry)  │  - Local Pharmacy Inventory  │
            │  - AI Depletion Forecasts    │                           │  - AI Depletion Forecasts    │
            │  - Emergency Sourcing / Map  │                           │  - Emergency Sourcing / Map  │
            │  - Incoming Request Queue    │                           │  - Incoming Request Queue    │
            └──────────────┬───────────────┘                       └───────────────┬──────────────┘
                           │                                                       │
                           └───────────────────────────┬───────────────────────────┘
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │  Node H03: Mangalore General │
                                        │  - Full Bi-Directional Node  │
                                        └──────────────────────────────┘
```

---

## 📋 Prerequisites

Ensure the following tools are installed on your machine:
- **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **Git**: ([Download Git](https://git-scm.com/))
- **Ollama**: (For Local GLM-4 LLM inference) ([Download Ollama](https://ollama.ai/))
- **Docker & Docker Compose** (Optional, for containerized deployment): ([Download Docker](https://www.docker.com/))

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/yashuhb18/MediLink.git
cd MediLink
```

### 2. Configure Server Environment (`server/.env`)
Create `server/.env` by copying the template:
```bash
cd server
cp .env.example .env
```
Edit `server/.env` with your preferred settings:
```env
PORT=5000
DB_MODE=mongodb
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/medilink?retryWrites=true&w=majority
JWT_SECRET=medilink-ai-super-secure-jwt-secret-2026
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=glm4
```
*(If you do not have MongoDB Atlas set up yet, set `DB_MODE=memory` to run using high-speed in-memory database).*

### 3. Install Dependencies
Open two separate terminal windows:

**Terminal 1 — Backend Server:**
```bash
cd server
npm install
npm run dev
```
*Backend server will start on `http://localhost:5000`.*

**Terminal 2 — Frontend Client:**
```bash
cd client
npm install
npm run dev
```
*Frontend web application will start on `http://localhost:3000`.*

---

## 🧠 Setting Up Local GLM-4 AI (Ollama)

MediLink AI utilizes local Large Language Model inference via Ollama for zero-cloud latency, privacy-preserving ICU clinical assessments.

1. **Install Ollama**: Download and install from [ollama.ai](https://ollama.ai/).
2. **Pull and Run GLM-4 Model**:
   ```bash
   ollama run glm4
   ```
3. **Verify Ollama Status**:
   Visit `http://localhost:11434` in your browser. You should see `Ollama is running`.
4. **MediLink Auto-Connect**:
   MediLink automatically routes requests to `http://localhost:11434/api/generate`. If Ollama is offline, MediLink automatically engages its intelligent rule-engine fallback.

---

## 🍃 Setting Up Your MongoDB Atlas Database

If your team or client wants to connect their own MongoDB Atlas instance:

1. **Sign Up / Log In**: Visit [MongoDB Atlas](https://cloud.mongodb.com) and create a free Shared M0 Cluster.
2. **Create Database User**:
   - Go to **Security ➔ Database Access**.
   - Click **Add New Database User** (e.g. `Username: medilink_admin`, choose password).
3. **Configure Network Access**:
   - Go to **Security ➔ Network Access**.
   - Click **Add IP Address** ➔ Select **Allow Access from Anywhere (`0.0.0.0/0`)** for development.
4. **Get Connection String**:
   - Click **Databases ➔ Connect ➔ Drivers (Node.js)**.
   - Copy the URI string:
     ```
     mongodb+srv://<username>:<password>@yourcluster.mongodb.net/medilink?retryWrites=true&w=majority
     ```
5. **Paste into `server/.env`**:
   Replace `MONGODB_URI` in `server/.env` with your new connection string and restart the server.

---

## 🐳 Running with Docker / Docker Compose

You can launch the entire ecosystem (Frontend + Backend) with a single command:

```bash
docker-compose up --build
```
- **Web Portal**: `http://localhost:3000`
- **REST API & SSE**: `http://localhost:5000`

---

## 👥 Role Login Matrix & Demo Accounts

Use these pre-configured clinical credentials to test all roles:

| Role / Station | Login Email | Password | Facility / Node | Primary Workflows |
| :--- | :--- | :--- | :--- | :--- |
| **🏭 Warehouse DC Lead** | `admin@medilink.ai` | `admin123` | Central Factory DC | GS1 Smart QR Generation, Pallet Outflow, Regional Grid |
| **🏥 Hospital Supervisor (H01)** | `supervisor@h01.medilink.ai` | `super123` | Apollo Hospital (Mysore) | Sourcing, Live GIS Map, Donor Queue, Live GPS Fleet |
| **🏥 Hospital Supervisor (H02)** | `supervisor@h02.medilink.ai` | `super123` | Bangalore Medical (BMC) | Sourcing, Live GIS Map, Donor Queue, Live GPS Fleet |
| **🔒 Dispatch Pharmacist** | `pharmacist@h02.medilink.ai` | `pharm123` | Bangalore Medical (BMC) | Physical Dual RFID + Barcode + Weight Verification |
| **🩺 Clinical Viewer** | `nurse@h01.medilink.ai` | `nurse123` | Apollo Hospital (Mysore) | Read-only Regional Stock Availability Directory |

---

## 📡 API & Hardware Endpoints

- **`GET /api/inventory/:hospitalId`** — Retrieve multi-unit stock for hospital node.
- **`GET /api/transfers/available-nodes?medicine=...&requestingHospitalId=...`** — Calculate nearest candidate donor nodes with road distance & transit ETA.
- **`POST /api/transfers`** — Create emergency transfer request with driver logistics mode.
- **`PUT /api/transfers/:id/accept`** — Accept incoming transfer request and queue dispatch.
- **`PUT /api/transfers/:id/assign-driver`** — Assign ambulance driver and contact telemetry.
- **`PUT /api/transfers/:id/update-transit`** — Stream real-time GPS progress, speed, and temperature.
- **`GET /api/events`** — Real-Time Server-Sent Events (SSE) telemetry stream for push sirens and notifications.
- **`POST /api/upload`** — Direct ESP32-CAM optical frame ingest and Cloudinary upload.

---

## 📄 License
Licensed under the [MIT License](LICENSE). Built with ❤️ for zero-stockout healthcare networks.
