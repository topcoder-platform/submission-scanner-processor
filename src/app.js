/**
 * The application entry point
 */
global.Promise = require('bluebird')
const config = require('config')
const logger = require('./common/logger')
const Kafka = require('no-kafka')
const ProcessorService = require('./services/ProcessorService')
const healthcheck = require('topcoder-healthcheck-dropin')

// create consumer
const options = {
  connectionString: config.KAFKA_URL,
  groupId: config.KAFKA_GROUP_ID
}
if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
  options.ssl = {
    cert: config.KAFKA_CLIENT_CERT,
    key: config.KAFKA_CLIENT_CERT_KEY
  }
}
const consumer = new Kafka.GroupConsumer(options)

const topics = [config.AVSCAN_TOPIC]

// data handler
const dataHandler = (messageSet, topic, partition) =>
  Promise.each(messageSet, async (m) => {
    const message = m.message.value.toString('utf8')
    logger.info(
      `Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${m.offset}; Message: ${message}.`
    )
    let messageJSON
    try {
      messageJSON = JSON.parse(message)
    } catch (e) {
      logger.error('Invalid message JSON.')
      logger.error(e)
      // ignore the message
      return
    }
    // Check if the topic in the payload is same as the Kafka topic
    if (messageJSON.topic !== topic) {
      logger.error(
        `The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}.`
      )
      // ignore the message
      return
    }

    // Process only messages with unscanned status
    if (
      messageJSON.topic === config.AVSCAN_TOPIC &&
      messageJSON.payload.status !== 'unscanned'
    ) {
      logger.debug(
        `Ignoring message in topic ${messageJSON.topic} with status ${messageJSON.payload.status}`
      )
      // ignore the message
      return
    }

    try {
      await ProcessorService.processScan(messageJSON)
      consumer.commitOffset({ topic, partition, offset: m.offset })
    } catch (err) {
      logger.error(err)

      // commit offset regardless of errors
      consumer.commitOffset({ topic, partition, offset: m.offset })
    }
  })

/*
 * Function to check if the Kafka connection is alive
 */
function check () {
  if (
    !consumer.client.initialBrokers &&
    !consumer.client.initialBrokers.length
  ) {
    return false
  }
  let connected = true
  consumer.client.initialBrokers.forEach((conn) => {
    logger.debug(`url ${conn.server()} - connected=${conn.connected}`)
    connected = conn.connected & connected
  })
  return connected
}

consumer
  .init([
    {
      subscriptions: topics,
      handler: dataHandler
    }
  ])
  // consume configured topics
  .then(() => {
    logger.info('Initialized.......')
    healthcheck.init([check])
    logger.info('Adding topics successfully.......')
    logger.info(topics)
    logger.info('Kick Start.......')
  })
