# 🏥 MediLink AI — Client Setup & Deployment Guide

This guide provides step-by-step instructions for setting up, configuring, and demonstrating MediLink AI on any local machine or cloud environment.

---

## 📋 1. System Requirements & Prerequisites

Before starting, ensure the following software is installed on the machine:

1. **Node.js (v18 or v20 LTS)**:
   - Download from: [https://nodejs.org/](https://nodejs.org/)
   - Verify installation: `node -v` (should be >= 18.0.0)
2. **Git**:
   - Download from: [https://git-scm.com/](https://git-scm.com/)
   - Verify installation: `git --version`
3. **Ollama (for Local GLM-4 AI Inference)**:
   - Download from: [https://ollama.ai/download](https://ollama.ai/download)
   - Verify installation: `ollama --version`

---

## 🍃 2. Customizing the MongoDB Atlas Connection String

If you want to point MediLink AI to your own MongoDB Atlas database:

### Step 2.1 — Create Database & User in MongoDB Atlas:
1. Log into your account at [https://cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a free shared cluster (or use an existing cluster).
3. In the left sidebar, navigate to **Database Access** ➔ Click **Add New Database User**:
   - Authentication Method: **Password**
   - Username: `your_username` (e.g. `medilink_admin`)
   - Password: `your_secure_password`
   - Role: **Atlas Admin** or **Read and write to any database**
4. In the left sidebar, navigate to **Network Access** ➔ Click **Add IP Address**:
   - Select **Allow Access from Anywhere (`0.0.0.0/0`)** for testing/development.

### Step 2.2 — Obtain Your Connection String:
1. Navigate to **Database** (or **Clusters**) ➔ Click **Connect**.
2. Select **Drivers** (Node.js).
3. Copy the connection string format:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/medilink?retryWrites=true&w=majority
   ```
   *(Replace `<username>` and `<password>` with the credentials created in Step 2.1).*

### Step 2.3 — Update `server/.env`:
Open `server/.env` in your code editor and update the `MONGODB_URI` line:
```env
MONGODB_URI=mongodb+srv://your_username:your_secure_password@cluster0.abcde.mongodb.net/medilink?retryWrites=true&w=majority
DB_MODE=mongodb
```
*Note: If you ever want to run completely offline without an internet connection or MongoDB Atlas, simply set `DB_MODE=memory`.*

---

## 🧠 3. Setting Up GLM-4 Local AI with Ollama

MediLink AI uses **GLM-4** locally via Ollama to generate clinical rationale for ICU medicine shortages without sending sensitive patient data to external cloud APIs.

1. **Start Ollama** on your machine.
2. Open your terminal and pull the GLM-4 model:
   ```bash
   ollama pull glm4
   ```
3. Run the model to verify:
   ```bash
   ollama run glm4
   ```
4. Ollama will automatically serve the API on `http://localhost:11434`.
5. MediLink AI connects directly to this endpoint via `server/.env` (`OLLAMA_BASE_URL=http://localhost:11434` and `OLLAMA_MODEL=glm4`).

---

## 🚀 4. Full Step-by-Step Installation & Launch

### Step 4.1 — Clone the Repository
```bash
git clone https://github.com/yashuhb18/MediLink.git
cd MediLink
```

### Step 4.2 — Install Backend Dependencies & Start Server
Open **Terminal 1**:
```bash
cd server
npm install
npm run dev
```
✅ The backend server will start on: **`http://localhost:5000`**

### Step 4.3 — Install Frontend Dependencies & Start Client
Open **Terminal 2**:
```bash
cd client
npm install
npm run dev
```
✅ The frontend web application will start on: **`http://localhost:3000`**

---

## 👥 5. Login Credentials & Demo Walkthrough

Navigate to **`http://localhost:3000`** in your browser to access the landing page.

### Pre-Configured Test Accounts:

| Facility / Node | Role | Login Email | Password | Workflows |
| :--- | :--- | :--- | :--- | :--- |
| **Apollo Hospital (Mysore - H01)** | Hospital Supervisor | `supervisor@h01.medilink.ai` | `super123` | Autonomous Bi-Directional Node (Sourcing, Donating, GPS Fleet, AI Forecasts) |
| **Bangalore Medical (BMC - H02)** | Hospital Supervisor | `supervisor@h02.medilink.ai` | `super123` | Autonomous Bi-Directional Node (Sourcing, Donating, GPS Fleet, AI Forecasts) |
| **Central Factory Warehouse (DC)** | Warehouse Lead | `admin@medilink.ai` | `admin123` | GS1 Smart QR Generation, Pallet Consignment Outflow, Regional Grid |
| **Bangalore Medical (BMC - H02)** | Dispatch Pharmacist | `pharmacist@h02.medilink.ai` | `pharm123` | Dual RFID + Barcode Optical Scanner Workstation |
| **Apollo Hospital (Mysore - H01)** | Clinical Viewer | `nurse@h01.medilink.ai` | `nurse123` | Read-only Regional Stock Availability Directory |

---

## 🧪 6. Recommended 3-Step Live Demo Scenario

### Step 1: Emergency Sourcing & Live Regional GIS Map (Mysore ➔ Bangalore)
1. Log in as **`supervisor@h01.medilink.ai`** (`super123`).
2. Navigate to **Emergency Sourcing & Map**.
3. Type `Paracetamol 500mg` or `Cough Relief Syrup` and choose dosage units (e.g. `20 Strips` or `15 Bottles`).
4. Select **Bangalore Medical Center (`H02`)** on the interactive India GIS Map.
5. Choose logistics mode:
   - 🚨 *Donor Hospital Ambulance Required*, OR
   - 🚑 *Requester Ambulance Dispatch*.
6. Click **Broadcast Emergency Request**.

### Step 2: Real-Time Siren Notification & Donor Dispatch (Bangalore `H02`)
1. In another browser window or tab, log in as **`supervisor@h02.medilink.ai`** (`super123`).
2. **Observe**:
   - 🔔 The Bell icon rings with an audio chime and red badge count.
   - 🚨 The top **Emergency Siren Banner** appears with 1-click **"Accept & Coordinate Dispatch"**.
3. Click **"Assign Ambulance & Accept"**, enter driver details (or keep defaults), and confirm dispatch.

### Step 3: Real-Time Live GPS Fleet Tracking
1. Switch to the **Live GPS Fleet** tab.
2. Watch the live ambulance progress bar glide along the highway corridor in real time (**speed `58 km/h`**, **temperature sensor `3.8°C Safe`**, and direct **Call / WhatsApp buttons** for the driver and facility incharge).

---

## 🛠️ 7. Troubleshooting

- **MongoDB Connection Error**:
  - Verify that your Atlas IP Whitelist has `0.0.0.0/0` enabled under Network Access.
  - Check that special characters in your password are URL-encoded if necessary.
  - Fallback: Set `DB_MODE=memory` in `server/.env` to run in high-speed in-memory database mode.
- **Ollama Connection**:
  - Ensure `ollama run glm4` is running in a background terminal.
  - If Ollama is not installed, the platform automatically activates its built-in rule engine fallback so all features continue working seamlessly.
