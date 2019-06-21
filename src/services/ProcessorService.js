/**
 * Service for Scanning Submissions
 */

const Joi = require('joi')
const logger = require('../common/logger')
const helper = require('../common/helper')
const tracer = require('../common/tracer')

/**
 * Process Scan request event
 * @param {Object} message the message
 */
async function processScan (message, span) {
  // Span is undefined during unittests. Create empty Spans object in order to avoid errors
  if (!span) {
    span = require('../common/tracer').startSpans('ProcessorService.processScan')
  }

  // Scan the file using ClamAV
  const isInfected = await helper.scanWithClamAV(message.payload.url, span)
  // Update Scanning results
  message.timestamp = (new Date()).toISOString()
  message.payload.status = 'scanned'
  message.payload.isInfected = isInfected

  let sendMessageSpan = tracer.startChildSpans('sendMessage', span)
  sendMessageSpan.setTag('topic', message.topic)
  sendMessageSpan.setTag('originator', message.originator)
  sendMessageSpan.log({
    event: 'debug',
    payload: message.payload
  })

  await helper.postToBusAPI(message)

  sendMessageSpan.finish()

  return message
}

processScan.schema = {
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    payload: Joi.object().keys({
      submissionId: Joi.string().required(),
      url: Joi.string().required(),
      fileName: Joi.string().required(),
      status: Joi.string().required()
    }).unknown(true).required()
  }).required()
}

// Exports
module.exports = {
  processScan
}

logger.buildService(module.exports)
