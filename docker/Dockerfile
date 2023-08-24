# Use the base image with Node.js 8.16.1
FROM node:18.16.1

# Copy the current directory into the Docker image
COPY . /file-scanner-processor

# Set working directory for future use
WORKDIR /file-scanner-processor

# Install the dependencies from package.json
RUN yarn install
