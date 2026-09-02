# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (for node-gyp if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy server source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start server
CMD ["node", "src/index.js"]
