FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Start Vite dev server with host option
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
