FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the code
COPY . .

EXPOSE 5173

# Set --host flag to be accessible from Docker/Caddy
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
