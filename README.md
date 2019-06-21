# Topcoder - Submission Scanner Processor

## Dependencies

- nodejs https://nodejs.org/en/ (v8+)
- Kafka
- Docker, Docker Compose (Only for deployment with Docker)
- DataDog
- LightStep
- SignalFX

## Configuration

Configuration of the Submission Scanner Processor is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- DISABLE_LOGGING: the boolean flag whether to disable logging
- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts; default value: 'localhost:9092'
- KAFKA_GROUP_ID: consumer group id; default value: 'tc-submission-scanner-processor-group'
- KAFKA_CLIENT_CERT: Kafka connection certificate, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to certificate file or certificate content
- KAFKA_CLIENT_CERT_KEY: Kafka connection private key, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to private key file or private key content
- AVSCAN_TOPIC: Topic for AV Scan related actions, default value is 'avscan.action.scan'
- CLAMAV_HOST: Host of Clam AV
- CLAMAV_PORT: Port of Clam AV
- BUSAPI_EVENTS_URL: Bus API Events URL
- AWS_REGION: AWS Region of S3 bucket if there is a need to read files from S3 bucket
- AUTH0_URL: Auth0 url for M2M token
- AUTH0_AUDIENCE: Auth0 audience for M2M token
- TOKEN_CACHE_TIME: Cache time of M2M token, optional
- AUTH0_CLIENT_ID: Auth0 client id for M2M token
- AUTH0_CLIENT_SECRET: Auth0 client secret for M2M token
- AUTH0_PROXY_SERVER_URL: Auth0 proxy url for M2M token

- tracing object will contain all configuration relate to integrate open tracing.
  1. dataDogEnabled, whether data dog tracing is enabled
  2. lightStepEnabled, whether light step tracing is enabled
  3. signalFXEnabled, whether singal fx tracing is enabled
  4. dataDog, all related configuration to initialize data dog tracer, refer https://datadog.github.io/dd-trace-js/ for more information
  5. lightStep, all related configuration to initialize light step tracer, refer https://github.com/lightstep/lightstep-tracer-javascript for more information
  6. signalFX, all related configuration to initialize signal fx tracer, refer https://github.com/signalfx/signalfx-nodejs-tracing/blob/master/docs/API.md#advanced-configuration for more information

Also note that there is a `/health` endpoint that checks for the health of the app. This sets up an expressjs server and listens on the environment variable `PORT`. It's not part of the configuration file and needs to be passed as an environment variable

## Local Kafka setup

- `http://kafka.apache.org/quickstart` contains details to setup and manage Kafka server,
  below provides details to setup Kafka server in Mac, Windows will use bat commands in bin/windows instead
- download kafka at `https://www.apache.org/dyn/closer.cgi?path=/kafka/1.1.0/kafka_2.11-1.1.0.tgz`
- extract out the downloaded tgz file
- go to the extracted directory kafka_2.11-0.11.0.1
- start ZooKeeper server:
  `bin/zookeeper-server-start.sh config/zookeeper.properties`
- use another terminal, go to same directory, start the Kafka server:
  `bin/kafka-server-start.sh config/server.properties`
- note that the zookeeper server is at localhost:2181, and Kafka server is at localhost:9092
- use another terminal, go to same directory, create some topics:
```
  bin/kafka-topics.sh --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic avscan.action.scan
```
- verify that the topics are created:
  `bin/kafka-topics.sh --list --zookeeper localhost:2181`,
  it should list out the created topics
- run the producer and then write some message into the console to send to the topic `avscan.action.scan`:
  `bin/kafka-console-producer.sh --broker-list localhost:9092 --topic avscan.action.scan`
- In the console, write some message, one message per line:
E.g.
```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://drive.google.com/uc?export=download&id=1RXpb4LvtWu864OZIYJS-zm4213RMckad","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip"}}
```
- optionally, use another terminal, go to same directory, start a consumer to view the messages:
```
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic avscan.action.scan --from-beginning
```

## Local deployment

1. go to https://www.datadoghq.com/, register a free trial account. refer https://app.datadoghq.com/account/settings#agent to install and start Datadog agent. refer https://docs.datadoghq.com/agent/apm/?tab=agent630 to ensure APM is enabled in your Datadog agent. refer https://app.datadoghq.com/logs/onboarding/server to ensure log is enabled in your Datadog agent.
2. go to https://go.lightstep.com/tracing.html, register a free trial account, then you will got an API token which is used as configuration value.
3. go to https://www.signalfx.com/, register a free trial account, login the web app and click integrations menu, follow info in `SignalFx SmartAgent` to install and start agent. On top right user avatar, choose `Organization Settings` and `Access Tokens` to get the API token.


4. From the project root directory, run the following command to install the dependencies

```
npm i
```

5. To run linters if required

```
npm run lint

npm run lint:fix # To fix possible lint errors
```

6. Set the environment variables as necessary. Refer to `config/default.js`

7. Start the processor

```
npm start
```

8. Ensure Clam AV is up, you can simply run `docker-compose up clamav` under project folder to setup Clam AV in your local environment. Note you should disable logging configuration and expose port 3310 at first if you don't deploy it on AWS.

## Local Deployment with Docker

To run the Submission Scoring Processor using docker, follow the below steps

1. Navigate to the directory `docker`

2. Rename the file `sample.api.env` to `api.env`

3. Set the required credentials in the file `api.env`

4. Once that is done, run the following command

```
docker-compose up
```

5. When you are running the application for the first time, It will take some time initially to download the image and install the dependencies

Note you should disable logging configuration if you don't deploy it on AWS.

## Verification

1. Ensure that Bus API and Clam AV is up and running. Refer Local deployment to setup DataDog/LightStep/SignalFX

2. Set the required environment variables

3. Ensure that Kafka is up and running and the topic `avscan.action.scan` is created in Kafka

4. Attach to the topic `avscan.action.scan` using Kafka console producer

```
bin/kafka-console-producer.sh --broker-list localhost:9092 --topic avscan.action.scan
```

5. Write the following message to the Console

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:15:05.821Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0502","url":"http://www.eicar.org/download/eicar_com.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0502.zip"}}
```

6. File in the above URL is an infected submission, hence the following message will be posted to Bus API

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:15:05.821Z","mime-type":"application/json","payload":{"status":"scanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0502","url":"http://www.eicar.org/download/eicar_com.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0502.zip","isInfected":true}}
```

7. Write the following message to the Console

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://s3.amazonaws.com/tc-test-submission-scan/good.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip"}}
```


8. File in the above URL is a clean submission, hence the following message will be posted to Bus API

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"scanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://s3.amazonaws.com/tc-test-submission-scan/good.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip","isInfected":false}}
```

9. Write the following message to Console, the status is scanned so you would see ignore message in Console.

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"scanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://s3.amazonaws.com/tc-test-submission-scan/good.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip","isInfected":false}}
```

9. Write the following message to Console, the topic is incorrect, you would see error message in Console.

```
{"topic":"avscan.action.invalid","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://s3.amazonaws.com/tc-test-submission-scan/good.zip","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip","isInfected":false}}
```

10. Write the following message to Console, the JSON message is invalid, you would see error message in Console.

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://s3.amazonaws.com/tc-test-submission-scan/good.zip",,"fileName":a12a4180-65aa-42ec-a945-5fd21dec0503.zip,"isInfected":false}}
```

11. Go to https://lauscher.topcoder-dev.com/, login with credential tonyj/appiro123, choose topic `avscan.action.scan` to verify the scan result message has successfully post by BUS API.

12. Go to https://app.lightstep.com/<Your_Project>/explorer and https://app.datadoghq.com/apm/traces to verify trace data in Lightstep and Datadog respectively. Currently, SignalFX is disabled so you don't need to verify it.

#### Running unit tests and coverage

To run unit tests alone

```
npm run test
```

To run unit tests with coverage report, you can check generated coverage report in coverage folder.

```
npm run cov
```