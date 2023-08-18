# Use the base image with Node.js 8.11.3
FROM node:18.12.1

# Copy the current directory into the Docker image
COPY . /file-scanner-processor

# Set working directory for future use
WORKDIR /file-scanner-processor

EXPOSE 3000

# Install the dependencies from package.json
RUN npm install
