/**
 * Contains generic helper methods
 */

const _ = require('lodash')
const config = require('config')
const clamav = require('clamav.js')
const streamifier = require('streamifier')
const logger = require('./logger')
const request = require('axios').default
const m2mAuth = require('tc-core-library-js').auth.m2m
const { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const m2m = m2mAuth(
  _.pick(config, [
    'AUTH0_URL',
    'AUTH0_AUDIENCE',
    'TOKEN_CACHE_TIME',
    'AUTH0_PROXY_SERVER_URL'
  ])
)
const AmazonS3URI = require('amazon-s3-uri')
const pure = require('@ronomon/pure')
const { WEBHOOK_AUTH_METHODS } = require('./constants')

const s3 = new S3Client({ region: config.get('aws.REGION') })

// Initialize ClamAV
let clamavScanner = null
const initClamAvScanner = () => {
  setTimeout(() => {
    logger.info('Checking ClamAV Status.')
    clamav.version(
      config.CLAMAV_PORT,
      config.CLAMAV_HOST,
      500,
      (error, status) => {
        if (error) {
          logger.info(`ClamAV not live yet. ${JSON.stringify(error)}`)
          initClamAvScanner()
        } else {
          logger.info('ClamAV connection established.', status)
          clamavScanner = clamav.createScanner(
            config.CLAMAV_PORT,
            config.CLAMAV_HOST
          )
        }
      }
    )
  }, 5000)
}

initClamAvScanner()

/**
 * Function to download file from given URL
 * @param {String} bucket Bucket of the file to be downloaded
 * @param {String} key Key of the file to be downloaded
 * @returns {Buffer} Buffer of downloaded file
 */
async function downloadFile (bucket, key) {
  logger.info(`downloadFile(): file is on S3 ${bucket} / ${key}`)
  const downloadedFile = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return Buffer.concat(await downloadedFile.Body.toArray())
}

function parseAndValidateUrl (fileUrl) {
  try {
    const { region, bucket, key } = new AmazonS3URI(fileUrl)
    return { region, bucket, key }
  } catch (err) {
    throw new Error(`${fileUrl} is not a valid S3 uri`)
  }
}

/**
 * check if the file is a zipbomb
 *
 * @param {string} fileBuffer the file buffer
 * @returns
 */
function isZipBomb (fileBuffer) {
  logger.info('Checking if file is a ZipBomb')
  try {
    const error = pure.zip(fileBuffer, 0)

    // we only care about zip bombs
    if (error.code === 'PURE_E_OK' || error.code.indexOf('ZIP_BOMB') === -1) {
      return [false]
    } else {
      return [true, error.code, error.message]
    }
  } catch (err) {
    throw new Error(`Error occurred while testing file to see if it is a ZipBomb`)
  }
}

async function scanWithClamAV (file) {
  logger.info('Scanning file with ClamAV')
  return new Promise((resolve, reject) => {
    clamav.version(
      config.CLAMAV_PORT,
      config.CLAMAV_HOST,
      500,
      (error, status) => {
        if (error) {
          logger.error('Unable to communicate with ClamAV')
          reject(error)
        } else {
          logger.info('ClamAV is up and running.', status)
          const fileStream = streamifier.createReadStream(file)
          try
          {
              clamavScanner.scan(fileStream, (scanErr, object, malicious) => {
                if (scanErr) {
                  logger.info('Scan Error')
                  reject(scanErr)
                }
                if (malicious == null) {
                  logger.info('File is clean')
                  resolve(false)
                } else {
                  logger.warn(`Infection detected ${malicious}`)
                  resolve(true)
                }
            })
          }
          catch (e) {
            logger.error(e)
            reject(e)
          }
        }
      }
    )
  })
}

/* Function to get M2M token
 * @returns {Promise}
 */
async function getM2Mtoken () {
  return m2m.getMachineToken(
    config.AUTH0_CLIENT_ID,
    config.AUTH0_CLIENT_SECRET
  )
}

/**
 * Function to POST to Bus API
 * @param{Object} reqBody Body of the request to be Posted
 * @returns {Promise}
 */
async function postToBusAPI (reqBody) {
  // M2M token necessary for pushing to Bus API
  const token = await getM2Mtoken()
  // Post the request body to Bus API
  return request.post(config.BUSAPI_EVENTS_URL, reqBody, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
}

/**
 * Move file from one AWS S3 bucket to another bucket.
 * @param {String} sourceBucket the source bucket
 * @param {String} sourceKey the source key
 * @param {String} targetBucket the target bucket
 * @param {String} targetKey the target key
 */
async function moveFile (sourceBucket, sourceKey, targetBucket, targetKey) {
  await s3.send(new CopyObjectCommand({ Bucket: targetBucket, CopySource: `${sourceBucket}/${sourceKey}`, Key: targetKey }))
  await s3.send(new DeleteObjectCommand({ Bucket: sourceBucket, Key: sourceKey }))
}

/**
 * Function to POST to Callback URL
 * @param{Object} message Body of the request to be Posted
 * @returns {Promise}
 */
async function postToCallbackURL (webHookOptions, data) {
  const { url, method, auth, secret } = webHookOptions
  const reqBody = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json'
    },
    data
  }
  if (auth === WEBHOOK_AUTH_METHODS.BEARER) {
    reqBody.headers.Authorization = `Bearer ${secret}`
  } else if (auth === WEBHOOK_AUTH_METHODS.BASIC) {
    reqBody.headers.Authorization = `Basic ${secret}`
  } else if (auth === WEBHOOK_AUTH_METHODS.API_KEY) {
    reqBody.headers['X-API-Key'] = secret
  }
  return request(reqBody)
}

/**
 * Post alert to Opsgenie
 * @param {String} message the message
 * @param {String} source the source
 * @param {String} priority the priority
 */
async function postAlertToOpsgenie (message, source, priority) {
  logger.info('Posting alert to Opsgenie')
  // print details
  logger.info(`message: ${message}`)
  logger.info(`source: ${source}`)
  logger.info(`priority: ${priority}`)
  try {
    request.post(config.OPSGENIE_API_URL, { message, source, priority }, {
      headers: {
        Authorization: `GenieKey ${config.OPSGENIE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })
  } catch (err) {
    logger.error(err)
  }
}

module.exports = {
  isZipBomb,
  scanWithClamAV,
  postToBusAPI,
  downloadFile,
  parseAndValidateUrl,
  moveFile,
  postToCallbackURL,
  postAlertToOpsgenie
}
