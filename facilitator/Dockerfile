FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Copy source.
COPY tsconfig.json ./
COPY src ./src

# tsx runtime is pulled in via devDependencies above; npm install already fetched it.
EXPOSE 3001

CMD ["npm", "start"]
