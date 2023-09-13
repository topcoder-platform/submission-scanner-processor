/**
 * The default configuration file.
 */

module.exports = {
  DISABLE_LOGGING: process.env.DISABLE_LOGGING || false, // If true, logging will be disabled
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  KAFKA_URL: process.env.KAFKA_URL || 'localhost:9092',
  // below are used for secure Kafka connection, they are optional
  // for the local Kafka, they are not needed
  KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT ? process.env.KAFKA_CLIENT_CERT.replace(/\\n/g, '\n') : null,
  KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY ? process.env.KAFKA_CLIENT_CERT_KEY.replace(/\\n/g, '\n') : null,

  // Kafka group id
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'file-scanner-processor',
  KAFKA_ORIGINATOR: process.env.KAFKA_ORIGINATOR || 'file-scanner-processor',

  aws: {
    REGION: process.env.AWS_REGION || 'us-east-1' // AWS Region to be used by the application
  },

  AVSCAN_TOPIC: process.env.AVSCAN_TOPIC || 'avscan.action.scan',
  CLAMAV_HOST: process.env.CLAMAV_HOST || 'filescanner',
  CLAMAV_PORT: process.env.CLAMAV_PORT || 3310,
  BUSAPI_EVENTS_URL: process.env.BUSAPI_EVENTS_URL || 'https://api.topcoder-dev.com/v5/bus/events',
  AUTH0_URL: process.env.AUTH0_URL, // Auth0 credentials for Submission scoring processor
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://www.topcoder.com',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,

  // Whitelisted buckets and topics
  WHITELISTED_CLEAN_BUCKETS: process.env.WHITELISTED_CLEAN_BUCKETS ? process.env.WHITELISTED_CLEAN_BUCKETS.split(',') : ['topcoder-dev-submissions', 'topcoder-submissions', 'topcoder-prod-media', 'topcoder-dev-media'],
  WHITELISTED_QUARANTINE_BUCKETS: process.env.WHITELISTED_QUARANTINE_BUCKETS ? process.env.WHITELISTED_QUARANTINE_BUCKETS.split(',') : ['topcoder-dev-submissions-quarantine', 'topcoder-submissions-quarantine', 'topcoder-prod-media-quarantine', 'topcoder-dev-media-quarantine'],
  WHITELISTED_KAFKA_TOPICS: process.env.WHITELISTED_KAFKA_TOPICS ? process.env.WHITELISTED_KAFKA_TOPICS.split(',') : ['submission.scan.complete', 'avscan.projects.assets.result']
}
