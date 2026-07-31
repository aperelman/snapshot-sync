FROM node:18-alpine

WORKDIR /app

# Install btrfs-progs for the sync scripts
RUN apk add --no-cache btrfs-progs sudo

COPY package*.json ./
RUN npm ci --only=production

COPY server.js .

EXPOSE 3001

CMD ["node", "server.js"]
