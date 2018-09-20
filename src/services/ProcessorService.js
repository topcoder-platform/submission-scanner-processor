/**
 * Service for Scanning Submissions
 */

const Joi = require('joi')
const logger = require('../common/logger')
const helper = require('../common/helper')

/**
 * Process Scan request event
 * @param {Object} message the message
 */
function * processScan (message) {
  // Scan the file using ClamAV
  const isInfected = yield helper.scanWithClamAV(message.payload.url)
  // Update Scanning results
  message.timestamp = (new Date()).toISOString()
  message.payload.status = 'scanned'
  message.payload.isInfected = isInfected

  yield helper.postToBusAPI(message)

  return true
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
