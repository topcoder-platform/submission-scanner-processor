/**
 * Service for Scanning Submissions
 */
const _ = require('lodash')
const Joi = require('joi')
const logger = require('../common/logger')
const helper = require('../common/helper')
const { CALLBACK_OPTIONS, WEBHOOK_HTTP_METHODS, WEBHOOK_AUTH_METHODS } = require('../common/constants')
const config = require('config')

const SCANNED_STATUS = 'scanned'
const SCAN_FAILED_STATUS = 'scan-failed'
const FILE_SIZE_EXCEEDED_ERROR_CODE = 'file-size-exceeded'

/**
 * Mark a scan payload as failed closed so callers receive a terminal result.
 * @param {Object} payload scan request payload to update
 * @param {String} errorCode machine-readable scan failure code
 * @param {String} errorMessage human-readable scan failure detail
 * @returns {Object} updated payload
 */
function markScanFailed (payload, errorCode, errorMessage) {
  payload.status = SCAN_FAILED_STATUS
  payload.isInfected = true
  payload.scanError = errorCode
  payload.scanErrorMessage = errorMessage
  return payload
}

async function handleResult (message, bucket, key) {
  if (message.moveFile) {
    // Move the file to the appropriate bucket
    const newBucket = message.isInfected ? message.quarantineDestinationBucket : message.cleanDestinationBucket
    await helper.moveFile(
      bucket,
      key,
      newBucket,
      message.fileName
    )
    message.url = `https://s3.amazonaws.com/${newBucket}/${message.fileName}`
  }

  if (message.isInfected && config.OPGENIE_ENABLED) {
    await helper.postAlertToOpsgenie(
      `Malicious file detected: File at ${message.url} is malicious.${message.moveFile ? ` The file has been moved to the ${message.quarantineDestinationBucket} bucket` : ''}`,
      config.OPSGENIE_SOURCE,
      message.moveFile ? 'P2' : 'P1'
    )
  }

  // Notify the caller
  if (message.callbackOption !== CALLBACK_OPTIONS.NO_CALLBACK) {
    const payload = _.omit(message, ['moveFile', 'cleanDestinationBucket', 'quarantineDestinationBucket', 'callbackOption', 'callbackHook', 'callbackKafkaTopic'])
    if (message.callbackOption === CALLBACK_OPTIONS.KAFKA) {
      await helper.postToBusAPI({
        originator: config.get('KAFKA_ORIGINATOR'),
        topic: message.callbackKafkaTopic,
        timestamp: new Date().toISOString(),
        'mime-type': 'application/json',
        payload
      })
    } else if (message.callbackOption === CALLBACK_OPTIONS.WEBHOOK) {
      await helper.postToCallbackURL(message.callbackHook, payload)
    }
  }
}

/**
 * Process Scan request event
 * @param {Object} message the message
 * @returns {Promise<Object>} processed scan payload result
 * @throws {Error} when the request URL is invalid, S3 cannot be read, ClamAV is unavailable, or result delivery fails
 */
async function processScan (message) {
  const { region, bucket, key } = helper.parseAndValidateUrl(message.payload.url)
  if (region !== config.get('aws.REGION')) {
    throw new Error(`region must be ${config.get('aws.REGION')}`)
  }
  const fileMetadata = await helper.getFileMetadata(bucket, key)
  if (fileMetadata.contentLength > config.MAX_SCAN_FILE_SIZE_BYTES) {
    const errorMessage = `File size ${fileMetadata.contentLength} bytes exceeds MAX_SCAN_FILE_SIZE_BYTES ${config.MAX_SCAN_FILE_SIZE_BYTES} bytes`
    logger.warn(errorMessage)
    return handleResult(markScanFailed({ ...message.payload }, FILE_SIZE_EXCEEDED_ERROR_CODE, errorMessage), bucket, key)
  }

  const fileStream = await helper.getFileStream(bucket, key)

  // Check if the file is a ZipBomb
  /* const [isZipBomb, errorCode, errorMessage] = helper.isZipBomb(downloadedFile)
  if (isZipBomb) {
    message.payload.isInfected = true
    logger.warn(
      `File at ${message.payload.url} is a ZipBomb. ${errorCode}: ${errorMessage}`
    )
    return handleResult({ ...message.payload }, bucket, key)
  } */

  // Scan the file using ClamAV
  let isInfected
  try {
    isInfected = await helper.scanWithClamAV(fileStream)
  } catch (error) {
    if (helper.isClamAvSizeLimitError(error)) {
      const errorMessage = `ClamAV rejected the stream because it exceeded the configured scan size limit: ${error.message}`
      logger.warn(errorMessage)
      return handleResult(markScanFailed({ ...message.payload }, FILE_SIZE_EXCEEDED_ERROR_CODE, errorMessage), bucket, key)
    }
    throw error
  }

  // Update Scanning results
  message.payload.status = SCANNED_STATUS
  message.payload.isInfected = isInfected
  return handleResult({ ...message.payload }, bucket, key)
}

processScan.schema = Joi.object({
  message: Joi.object().keys({
    topic: Joi.string().required(),
    originator: Joi.string().required(),
    timestamp: Joi.date().required(),
    'mime-type': Joi.string().required(),
    payload: Joi.object().keys({
      url: Joi.string().uri().required(),
      fileName: Joi.string().required(),
      moveFile: Joi.bool().required(),
      cleanDestinationBucket: Joi.when('moveFile',
        {
          is: true,
          then: Joi.string().required().valid(...config.get('WHITELISTED_CLEAN_BUCKETS')),
          otherwise: Joi.forbidden()
        }),
      quarantineDestinationBucket: Joi.when('moveFile',
        {
          is: true,
          then: Joi.string().required().valid(...config.get('WHITELISTED_QUARANTINE_BUCKETS')),
          otherwise: Joi.forbidden()
        }),
      callbackOption: Joi.string().required().valid(..._.values(CALLBACK_OPTIONS)).insensitive(),
      callbackHook: Joi.when('callbackOption', {
        is: CALLBACK_OPTIONS.WEBHOOK,
        then: Joi.object().keys({
          url: Joi.string().uri().required(),
          method: Joi.string().required().valid(..._.values(WEBHOOK_HTTP_METHODS)).insensitive(),
          auth: Joi.string().required().valid(..._.values(WEBHOOK_AUTH_METHODS)).insensitive(),
          secret: Joi.when('auth',
            {
              not: WEBHOOK_AUTH_METHODS.NO_AUTH,
              then: Joi.string().required(),
              otherwise: Joi.forbidden()
            })
        }).required(),
        otherwise: Joi.forbidden()
      }),
      callbackKafkaTopic: Joi.when('callbackOption',
        {
          is: CALLBACK_OPTIONS.KAFKA,
          then: Joi.string().required().valid(...config.get('WHITELISTED_KAFKA_TOPICS')),
          otherwise: Joi.forbidden()
        })
    }).unknown(true).required()
  }).required()
}).required()

// Exports
module.exports = {
  processScan
}

logger.buildService(module.exports)
