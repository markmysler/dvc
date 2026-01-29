FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install curl for healthcheck
RUN apk add --no-cache curl

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Run the development server on port 3001 to avoid conflicts
ENV PORT=3001
CMD ["npm", "run", "dev"]