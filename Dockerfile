# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and frontend package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies for both root and frontend
RUN npm install
RUN npm install --prefix frontend

# Copy the entire project
COPY . .

# Build the frontend
RUN npm run frontend:build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend code and built frontend assets from builder stage
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose the server port
EXPOSE 7676

# Set environment to production
ENV NODE_ENV=production
ENV STREAMFLOW_CONFIG_DIR=/app/data

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Start the server using the correct path
CMD ["node", "backend/server.js"]
