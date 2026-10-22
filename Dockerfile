FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY ui-kit ./ui-kit

ENV HOST=0.0.0.0 PORT=3001 DATA_DIR=/app/data
EXPOSE 3001
CMD ["node", "src/server.js"]
