FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Set Docker environment variable
ENV DOCKER=true

# Expose Vite dev server port
EXPOSE 3000

# Start Vite dev server with Docker mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--mode", "docker"]
