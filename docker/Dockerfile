# Use the base image with Node.js 8.11.3
FROM node:8.11.3

# Copy the current directory into the Docker image
COPY . /submission-scanner-processor

# Set working directory for future use
WORKDIR /submission-scanner-processor

# Install the dependencies from package.json
RUN npm install
