# 🐳 MediLink AI — Docker Hub Deployment Guide for `yashwanth0505`

The project is configured for your Docker Hub account: **`yashwanth0505`**

---

## ⚡ 1. Build and Push to Docker Hub (3 Simple Commands)

Open PowerShell or Command Prompt in `d:\MediLink` and run:

```bash
# Step 1: Log in to Docker Hub
docker login

# Step 2: Build the images
docker compose build

# Step 3: Push both images to your Docker Hub repository
docker compose push
```

Your images will be publicly live at:
- **`yashwanth0505/medilink-backend:latest`**
- **`yashwanth0505/medilink-frontend:latest`**

---

## 🚀 2. How Anyone Else Can Pull & Run Your Project

Anyone (hospital clients, evaluators, judges) on any Windows, Mac, or Linux computer can run your entire platform with:

```bash
# 1. Pull the images from your Docker Hub
docker pull yashwanth0505/medilink-backend:latest
docker pull yashwanth0505/medilink-frontend:latest

# 2. Run Backend (Port 5000)
docker run -d -p 5000:5000 --name medilink-api yashwanth0505/medilink-backend:latest

# 3. Run Frontend (Port 3000)
docker run -d -p 3000:3000 --name medilink-web yashwanth0505/medilink-frontend:latest
```

---

## 🌐 3. Accessing the Live Portals
- **Portals & Dashboards:** [http://localhost:3000](http://localhost:3000)
  - `/warehouse` & `/admin` — Central Pharma Warehouse & GS1 Serialization
  - `/clinical` — Bedside Clinical Viewer
  - `/supervisor-req` — Requesting Hospital Supervisor
  - `/supervisor-src` — Source Donor Supervisor
  - `/pharmacist` — Dispatch Pharmacist Terminal
- **Backend API & Optical Engine:** [http://localhost:5000](http://localhost:5000)
