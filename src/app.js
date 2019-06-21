/**
 * The application entry point
 */

global.Promise = require('bluebird')
const config = require('config')
const logger = require('./common/logger')
const Kafka = require('no-kafka')
const ProcessorService = require('./services/ProcessorService')
const healthcheck = require('topcoder-healthcheck-dropin')
const tracer = require('./common/tracer')

// Initialize tracing if configured.
// Even if tracer is not initialized, all calls to tracer module will not raise any errors
if (config.has('tracing')) {
  tracer.initTracing(config.get('tracing'))
}

// create consumer
const options = { connectionString: config.KAFKA_URL, groupId: config.KAFKA_GROUP_ID }
if (config.KAFKA_CLIENT_CERT && config.KAFKA_CLIENT_CERT_KEY) {
  options.ssl = { cert: config.KAFKA_CLIENT_CERT, key: config.KAFKA_CLIENT_CERT_KEY }
}
const consumer = new Kafka.GroupConsumer(options)

const topics = [config.AVSCAN_TOPIC]

// data handler
const dataHandler = (messageSet, topic, partition) => Promise.each(messageSet, async (m) => {
  const span = tracer.startSpans('dataHandler')
  span.setTag('kafka.topic', topic)
  span.setTag('message_bus.destination', topic)
  span.setTag('kafka.partition', partition)
  span.setTag('kafka.offset', m.offset)

  const message = m.message.value.toString('utf8')
  logger.info(`Handle Kafka event message; Topic: ${topic}; Partition: ${partition}; Offset: ${
    m.offset}; Message: ${message}.`)

  const parserSpan = tracer.startChildSpans('parseMessage', span)
  let messageJSON
  try {
    messageJSON = JSON.parse(message)
  } catch (e) {
    logger.error('Invalid message JSON.')
    logger.logFullError(e)
    // commit the message and ignore it
    await consumer.commitOffset({
      topic, partition, offset: m.offset
    })

    parserSpan.setTag('error', true)
    parserSpan.log({
      event: 'error',
      message: e.message,
      stack: e.stack,
      'error.object': e
    })
    parserSpan.finish()
    span.finish()

    return
  }
  parserSpan.finish()

  // Check if the topic in the payload is same as the Kafka topic
  if (messageJSON.topic !== topic) {
    logger.error(`The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}.`)
    // commit the message and ignore it
    await consumer.commitOffset({
      topic, partition, offset: m.offset
    })

    span.setTag('error', true)
    span.log({
      event: 'error',
      message: `The message topic ${messageJSON.topic} doesn't match the Kafka topic ${topic}`
    })
    span.finish()

    return
  }

  // Process only messages with unscanned status
  if (messageJSON.topic === config.AVSCAN_TOPIC && messageJSON.payload.status !== 'unscanned') {
    logger.debug(`Ignoring message in topic ${messageJSON.topic} with status ${messageJSON.payload.status}`)
    // ignore the message
    span.log({
      event: 'info',
      message: `Ignoring message in topic ${messageJSON.topic} with status ${messageJSON.payload.status}`
    })
    span.finish()

    return
  }

  let serviceSpan

  try {
    serviceSpan = tracer.startChildSpans('ProcessorService.processScan', span)
    await ProcessorService.processScan(messageJSON, serviceSpan)

    serviceSpan.finish()
    logger.debug('Successfully processed message')
  } catch (err) {
    logger.logFullError(err)

    span.setTag('error', true)
    if (serviceSpan) {
      serviceSpan.log({
        event: 'error',
        message: err.message,
        stack: err.stack,
        'error.object': err
      })
      serviceSpan.setTag('error', true)
      serviceSpan.finish()
    }
  } finally {
    // Commit offset regardless of error
    await consumer.commitOffset({
      topic, partition, offset: m.offset
    })

    span.finish()
  }
})

/*
 * Function to check if the Kafka connection is alive
 */
function check () {
  if (!consumer.client.initialBrokers && !consumer.client.initialBrokers.length) {
    return false
  }
  let connected = true
  consumer.client.initialBrokers.forEach(conn => {
    logger.debug(`url ${conn.server()} - connected=${conn.connected}`)
    connected = conn.connected & connected
  })
  return connected
}

consumer
  .init([{
    subscriptions: topics,
    handler: dataHandler
  }])
  // consume configured topics
  .then(() => {
    logger.info('Initialized.......')
    healthcheck.init([check])
    logger.info('Adding topics successfully.......')
    logger.info(topics)
    logger.info('Kick Start.......')
  })
  .catch((err) => logger.error(err))
