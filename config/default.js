/**
 * The default configuration file.
 */

module.exports = {
  DISABLE_LOGGING: process.env.DISABLE_LOGGING ? process.env.DISABLE_LOGGING === 'true' : false, // If true, logging will be disabled
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  KAFKA_URL: process.env.KAFKA_URL || 'localhost:9092',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'tc-submission-scanner-processor-group',
  // below are used for secure Kafka connection, they are optional
  // for the local Kafka, they are not needed
  KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT ? process.env.KAFKA_CLIENT_CERT.replace(/\\n/g, '\n') : null,
  KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY ? process.env.KAFKA_CLIENT_CERT_KEY.replace(/\\n/g, '\n') : null,

  aws: {
    REGION: process.env.AWS_REGION || 'us-east-1' // AWS Region to be used by the application
  },

  AVSCAN_TOPIC: process.env.AVSCAN_TOPIC || 'avscan.action.scan',
  CLAMAV_HOST: process.env.CLAMAV_HOST || 'localhost',
  CLAMAV_PORT: process.env.CLAMAV_PORT || 3310,
  BUSAPI_EVENTS_URL: process.env.BUSAPI_EVENTS_URL || 'https://api.topcoder-dev.com/v5/bus/events',
  AUTH0_URL: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,

  tracing: {
    dataDogEnabled: process.env.DATADOG_ENABLED ? process.env.DATADOG_ENABLED === 'true' : true,
    lightStepEnabled: process.env.LIGHTSTEP_ENABLED ? process.env.LIGHTSTEP_ENABLED === 'true' : true,
    signalFXEnabled: process.env.SIGNALFX_ENABLED ? process.env.SIGNALFX_ENABLED === 'true' : false,

    dataDog: {
      service: process.env.DATADOG_SERVICE_NAME || 'tc-submission-scanner-processor',
      hostname: process.env.DD_TRACE_AGENT_HOSTNAME
    },

    lightStep: {
      access_token: process.env.LIGHTSTEP_ACCESS_TOKEN,
      component_name: process.env.LIGHTSTEP_COMPONENT_NAME || 'tc-submission-scanner-processor'
    },

    signalFX: {
      service: process.env.SIGNALFX_SERVICE_NAME || 'tc-submission-scanner-processor',
      accessToken: process.env.SIGNALFX_ACCESS_TOKEN,
      url: `https://${process.env.SIGNALFX_TRACE_AGENT_HOSTNAME}:9080/v1/trace`
    }
  }
}
