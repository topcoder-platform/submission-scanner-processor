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
  message.timestamp = (new Date()).toISOString()
  message.payload.status = 'scanned'

  const downloadedFile = yield helper.downloadFile(message.payload.url);

  // Scan the file using ClamAV
  const [isZipBomb, errorCode, errorMessage] = helper.isZipBomb(downloadedFile);
  if (isZipBomb) {
    message.isInfected = true;
    logger.warn(`File at ${message.payload.url} is a ZipBomb. ${errorCode}: ${errorMessage}`);
    yield helper.postToBusAPI(message)
    return message;
  }

  const isInfected = yield helper.scanWithClamAV(downloadedFile)
  
  // Update Scanning results
  message.payload.isInfected = isInfected

  yield helper.postToBusAPI(message)

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
