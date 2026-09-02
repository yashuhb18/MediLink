# Base Node.js image
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Set environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js production bundle
RUN npm run build

# Expose web portal port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
