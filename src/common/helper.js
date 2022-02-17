/**
 * Contains generic helper methods
 */

global.Promise = require('bluebird')
const _ = require('lodash')
const config = require('config')
const clamav = require('clamav.js')
const streamifier = require('streamifier')
const logger = require('./logger')
const request = require('axios')
const m2mAuth = require('tc-core-library-js').auth.m2m
const m2m = m2mAuth(_.pick(config, ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME', 'AUTH0_PROXY_SERVER_URL']))
const AWS = require('aws-sdk')
const AmazonS3URI = require('amazon-s3-uri')
const pure = require("@ronomon/pure");

AWS.config.region = config.get('aws.REGION')
const s3 = new AWS.S3()

// Initialize ClamAV
const clamavScanner = clamav.createScanner(config.CLAMAV_PORT, config.CLAMAV_HOST)

/**
 * Function to download file from given URL
 * @param{String} fileURL URL of the file to be downloaded
 * @returns {Buffer} Buffer of downloaded file
 */
function * downloadFile (fileURL) {
  let downloadedFile
  if (/.*amazonaws.*/.test(fileURL)) {
    const { bucket, key } = AmazonS3URI(fileURL)
    logger.info(`downloadFile(): file is on S3 ${bucket} / ${key}`)
    downloadedFile = yield s3.getObject({ Bucket: bucket, Key: key }).promise()
    return downloadedFile.Body
  } else {
    logger.info(`downloadFile(): file is (hopefully) a public URL at ${fileURL}`)
    downloadedFile = yield request.get(fileURL, { responseType: 'arraybuffer' })
    return downloadedFile.data
  }
}

/**
 * check if the file is a zipbomb
 *
 * @param {string} fileBuffer the file buffer
 * @returns
 */
 function isZipBomb(fileBuffer) {
  const error = pure.zip(fileBuffer, 0);

  // we only care about zip bombs
  if (error.code === "PURE_E_OK" || error.code.indexOf("ZIP_BOMB") === -1) {
    return [false];
  } else {
    return [true, error.code, error.message];
  }
}

function * scanWithClamAV (file) {
  // Scan
  const fileStream = streamifier.createReadStream(file)
  return new Promise((resolve, reject) => {
    clamavScanner.scan(fileStream, (scanErr, object, malicious) => {
      if (scanErr) {
        reject(scanErr)
      }
      // Return True / False depending on Scan result
      if (malicious) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}

/* Function to get M2M token
 * @returns {Promise}
 */
function * getM2Mtoken () {
  return yield m2m.getMachineToken(config.AUTH0_CLIENT_ID, config.AUTH0_CLIENT_SECRET)
}

/**
 * Function to POST to Bus API
 * @param{Object} reqBody Body of the request to be Posted
 * @returns {Promise}
 */
function * postToBusAPI (reqBody) {
  // M2M token necessary for pushing to Bus API
  const token = yield getM2Mtoken()

  Promise.promisifyAll(request)

  // Post the request body to Bus API
  yield request
    .post(config.BUSAPI_EVENTS_URL, reqBody,
      { headers: { 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' }})
}

module.exports = {
  isZipBomb,
  scanWithClamAV,
  postToBusAPI,
  downloadFile
}
