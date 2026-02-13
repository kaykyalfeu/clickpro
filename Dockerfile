FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY index.js ./
COPY lib/ ./lib/
COPY db/ ./db/
COPY index.html* ./

# Create persistent data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok)throw r.status;process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
