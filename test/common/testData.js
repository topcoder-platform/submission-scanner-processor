/*
 * Test data to be used in tests
 */

const uuid = require('uuid/v4')

const goodSubmission = {
  topic: 'submission.notification.create',
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    submissionId: uuid(),
    url: 'https://drive.google.com/uc?export=download&id=1RXpb4LvtWu864OZIYJS-zm4213RMckad',
    fileName: 'good.zip',
    status: 'unscanned'
  }
}

const infectedSubmission = {
  topic: 'submission.notification.create',
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    submissionId: uuid(),
    url: 'http://www.eicar.org/download/eicar_com.zip',
    fileName: 'infected.zip',
    status: 'unscanned'
  }
}

const s3Submission = {
  topic: 'submission.notification.create',
  originator: 'submission-api',
  timestamp: '2018-02-03T00:00:00',
  'mime-type': 'application/json',
  payload: {
    submissionId: uuid(),
    url: 'https://s3.amazonaws.com/tc-test-submission-scan/good.zip',
    fileName: 's3.zip',
    status: 'unscanned'
  }
}

module.exports = {
  goodSubmission,
  infectedSubmission,
  s3Submission
}
