FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# We omit electron and devDependencies which we don't need for the headless web app
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Expose the server port
EXPOSE 7676

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
