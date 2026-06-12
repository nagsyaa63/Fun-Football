# Small production image for Fun Football (Node + Postgres via DATABASE_URL)
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching).
# pg is pure JS — no native build tools required.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

ENV PORT=3000
EXPOSE 3000

# Provide DATABASE_URL, ADMIN_PASSWORD and SESSION_SECRET at runtime.
# Seed once after first deploy:  docker exec -it <container> npm run seed
CMD ["npm", "start"]
