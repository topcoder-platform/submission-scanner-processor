/**
 * Service for Scanning Submissions
 */
const _ = require('lodash')
const Joi = require('joi')
const logger = require('../common/logger')
const helper = require('../common/helper')
const { CALLBACK_OPTIONS, WEBHOOK_HTTP_METHODS, WEBHOOK_AUTH_METHODS } = require('../common/constants')
const config = require('config')

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
 */
async function processScan (message) {
  const { region, bucket, key } = helper.parseAndValidateUrl(message.payload.url)
  if (region !== config.get('aws.REGION')) {
    throw new Error(`region must be ${config.get('aws.REGION')}`)
  }
  const downloadedFile = await helper.downloadFile(bucket, key)

  // Check if the file is a ZipBomb
  const [isZipBomb, errorCode, errorMessage] = helper.isZipBomb(downloadedFile)
  if (isZipBomb) {
    message.payload.isInfected = true
    logger.warn(
      `File at ${message.payload.url} is a ZipBomb. ${errorCode}: ${errorMessage}`
    )
    return handleResult({ ...message.payload }, bucket, key)
  }

  // Scan the file using ClamAV
  const isInfected = await helper.scanWithClamAV(downloadedFile)

  // Update Scanning results
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
