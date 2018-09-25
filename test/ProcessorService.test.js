/**
 * Unit tests for Processor Service
 */

// During the test the env variable is set to test
process.env.NODE_ENV = 'test'

const should = require('chai').should() // eslint-disable-line
const ProcessorService = require('../src/services/ProcessorService')
const co = require('co')
const { infectedSubmission, goodSubmission, s3Submission } = require('./common/testData')

describe('Processor Service Unit tests', () => {
  it('Infected submission should should have isInfected equal to true', (done) => {
    co(function * () {
      const result = yield ProcessorService.processScan(infectedSubmission)
      result.payload.url.should.be.equal(infectedSubmission.payload.url)
      result.payload.status.should.be.equal('scanned')
      result.payload.isInfected.should.be.equal(true)
    })
      .then(() => done())
      .catch(done)
  }).timeout(10000)

  it('Good submission should should have isInfected equal to false', (done) => {
    co(function * () {
      const result = yield ProcessorService.processScan(goodSubmission)
      result.payload.url.should.be.equal(goodSubmission.payload.url)
      result.payload.status.should.be.equal('scanned')
      result.payload.isInfected.should.be.equal(false)
    })
      .then(() => done())
      .catch(done)
  }).timeout(10000)

  it('Good submission from s3 should should have isInfected equal to false', (done) => {
    co(function * () {
      const result = yield ProcessorService.processScan(s3Submission)
      result.payload.url.should.be.equal(s3Submission.payload.url)
      result.payload.status.should.be.equal('scanned')
      result.payload.isInfected.should.be.equal(false)
    })
      .then(() => done())
      .catch(done)
  }).timeout(10000)
})
