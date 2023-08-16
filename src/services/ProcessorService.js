/**
 * Service for Scanning Submissions
 */
const _ = require("lodash");
const Joi = require("joi");
const logger = require("../common/logger");
const helper = require("../common/helper");
const config = require("config");

async function handleResult(message) {
  // Move the file to the appropriate bucket
  if (message.payload.isInfected) {
    if (message.payload.quarantineDestinationBucket) {
      await helper.moveFile(
        config.get('aws.DMZ_BUCKET'),
        message.payload.fileName,
        message.payload.quarantineDestinationBucket,
        message.payload.fileName
      );
      // Update the URL
      message.payload.url = `https://s3.amazonaws.com/${message.payload.quarantineDestinationBucket}/${message.payload.fileName}`;
    } else {
      // throw error about missing quarantine bucket
      throw new Error(`File ${message.payload.fileName} is infected but no quarantine bucket is configured`);
    }
  } else {
    if (message.payload.cleanDestinationBucket) {
      await helper.moveFile(
        config.get('aws.DMZ_BUCKET'),
        message.payload.fileName,
        message.payload.cleanDestinationBucket,
        message.payload.fileName
      );
      // Update the URL
      message.payload.url = `https://s3.amazonaws.com/${message.payload.cleanDestinationBucket}/${message.payload.fileName}`;
    } else {
      // throw error about missing clean bucket
      throw new Error(`File ${message.payload.fileName} is clean but no clean bucket is configured`);
    }
  }
  // Notify the caller
  if (message.payload.callbackTopic) {
    message.originator = config.get('KAFKA_ORIGINATOR');
    message.topic = message.payload.callbackTopic;
    await helper.postToBusAPI(message);
  }
  if (message.payload.callbackUrl) {
    await helper.postToCallbackURL(_.omit(message.payload, ['callbackUrl', 'callbackTopic']));
  }
}

/**
 * Process Scan request event
 * @param {Object} message the message
 */
async function processScan(message) {
  message.timestamp = new Date().toISOString();
  message.payload.status = "scanned";
  const downloadedFile = await helper.downloadFile(message.payload.url);

  // Check if the file is a ZipBomb
  const [isZipBomb, errorCode, errorMessage] = helper.isZipBomb(downloadedFile);
  if (isZipBomb) {
    message.payload.isInfected = true;
    logger.warn(
      `File at ${message.payload.url} is a ZipBomb. ${errorCode}: ${errorMessage}`
    );
    return handleResult(message);
  }

  // Scan the file using ClamAV
  const isInfected = await helper.scanWithClamAV(downloadedFile);

  // Update Scanning results
  message.payload.isInfected = isInfected;
  return handleResult(message);
}

processScan.schema = {
  message: Joi.object()
    .keys({
      topic: Joi.string().required(),
      originator: Joi.string().required(),
      timestamp: Joi.date().required(),
      "mime-type": Joi.string().required(),
      payload: Joi.object()
        .keys({
          url: Joi.string().required(),
          cleanDestinationBucket: Joi.string().default(config.get('aws.DEFAULT_CLEAN_BUCKET')).valid(config.get('WHITELISTED_CLEAN_BUCKETS')),
          quarantineDestinationBucket: Joi.string().default(config.get('aws.DEFAULT_QUARANTINE_BUCKET')),
          fileName: Joi.string().required(),
          callbackUrl: Joi.string(),
          callbackTopic: Joi.string().default(config.get('AVSCAN_TOPIC')),
        })
        .unknown(true)
        .required(),
    })
    .required(),
};

// Exports
module.exports = {
  processScan,
};

logger.buildService(module.exports, "ProcessorService");
