FROM node:16.14.0-alpine

RUN apk add g++ make python3

RUN mkdir -p /submission-scanner-processor

# Set working directory for future use
WORKDIR /submission-scanner-processor

# Copy the current directory into the Docker image
COPY . .



# Install the dependencies from package.json
RUN npm install

EXPOSE 3000