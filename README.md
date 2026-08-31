# 🏥 MediLink — Zero-Stockout Medicine Redistribution Network

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-v14-black.svg)](https://nextjs.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas%20Cloud-emerald.svg)](https://www.mongodb.com/atlas)
[![ESP32 IoT](https://img.shields.io/badge/IoT-ESP32--CAM%20%2B%20Sensors-teal.svg)](https://espressif.com/)

> **Autonomous AI, Game-Theory & IoT Hardware Network for Regional Inter-Hospital Medicine Redistribution.**

---

## 🌟 Key Features

1. **🔮 AI Time-Traveler Depletion Forecasting**:
   - Continuous HX711 load-cell telemetry polling.
   - Linear regression and burn rate modeling predicting zero-stock events **5 hours in advance**.
2. **⚖️ Karma Market (Nash Equilibrium Multi-Node Matching)**:
   - Dynamic game-theory reputation incentive mechanism.
   - Ranks donor hospitals based on surplus stock, travel distance, and Karma reliability score.
3. **✍️ 1-Click Cryptographic Clinical Authorization**:
   - Seamless role-based review with SHA-256 digital signature.
4. **🔒 Physical Hardware Dual-Lock Dispensing**:
   - Hardware-enforced verification matching optical Laser Barcode UID with RC522 RFID Smart Tag.
   - Automated ESP32 solenoid vault latch unlock.
5. **📷 ESP32-CAM Live Hardware Telemetry & Cloud Storage**:
   - Direct image capture of medicine inventory streamed to MongoDB Atlas cloud database.
6. **🗺️ Regional Live GIS Grid**:
   - OpenStreetMap interactive India hospital nodes tracking inventory availability and stockout alerts.

---

## 🏗️ System Architecture

```
                       ┌────────────────────────┐
                       │  ESP32-CAM + HX711 IoT │
                       │  Load Cell & Sensors   │
                       └───────────┬────────────┘
                                   │ HTTPS / Cloudflare Tunnel
                                   ▼
                       ┌────────────────────────┐
                       │  MediLink Express API  │ (Port 5000)
                       └───────────┬────────────┘
                                   │ Mongoose ODM
                                   ▼
                       ┌────────────────────────┐
                       │  MongoDB Atlas Cloud   │
                       └────────────────────────┘
                                   ▲
                                   │ REST API / Axios
                                   ▼
                       ┌────────────────────────┐
                       │  Next.js 14 Web App    │ (Port 3000)
                       │  5 Role-Based Portals  │
                       └────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster connection URI

### 2. Backend Setup
```bash
cd server
npm install
# Configure your MongoDB connection string in .env:
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/medilink
npm run dev
```

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 👥 Role-Based Workstations

- **Admin Hub** (`/admin`): Regional stock distribution, live OpenStreetMap hospital nodes, system telemetry.
- **Clinical Supervisor** (`/clinical`): 1-Click digital signature and requisition approvals.
- **Requesting Supervisor** (`/supervisor-req`): Urgent medicine requests and predictive shortage tracker.
- **Sourcing Supervisor** (`/supervisor-src`): Donor hospital matching and Karma point ledger.
- **Station Pharmacist** (`/pharmacist`): Optical barcode scanning, RFID verification, and IoT vault management.

---

## 📜 License
MIT License © 2026 MediLink.
