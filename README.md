# Topcoder - Submission Scanner Processor

## Dependencies

- nodejs https://nodejs.org/en/ (v8+)
- Kafka
- Docker, Docker Compose (Only for deployment with Docker)

## Configuration

Configuration of the Submission Scanner Processor is at `config/default.js`.
The following parameters can be set in config files or in env variables:

- LOG_LEVEL: the log level; default value: 'debug'
- KAFKA_URL: comma separated Kafka hosts; default value: 'localhost:9092'
- KAFKA_CLIENT_CERT: Kafka connection certificate, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to certificate file or certificate content
- KAFKA_CLIENT_CERT_KEY: Kafka connection private key, optional; default value is undefined;
    if not provided, then SSL connection is not used, direct insecure connection is used;
    if provided, it can be either path to private key file or private key content
- KAFKA_GROUP_ID: the Kafka group id, default value is 'submission-scanner-processor'
- AVSCAN_TOPIC: Topic for AV Scan related actions, default value is 'avscan.action.scan'
- CLAMAV_HOST: Host of Clam AV
- CLAMAV_PORT: Port of Clam AV
- BUSAPI_EVENTS_URL: Bus API Events URL
- AWS_REGION: AWS Region of S3 bucket if there is a need to read files from S3 bucket

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
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://drive.google.com/file/d/16kkvI-itLYaH8IuVDrLsRL94t-HK1w19/view?usp=sharing","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip"}}
```
- optionally, use another terminal, go to same directory, start a consumer to view the messages:
```
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic avscan.action.scan --from-beginning
```

## Local deployment

1. From the project root directory, run the following command to install the dependencies

```
npm i
```

2. To run linters if required

```
npm run lint

npm run lint:fix # To fix possible lint errors
```

3. Set the environment variables as necessary. Refer to `config/default.js`

4. Start the processor

```
npm start
```

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


## Verification

1. Ensure that Bus API and Clam AV is up and running

2. Set the required environment variables

3. Ensure that Kafka is up and running and the topic `avscan.action.scan` is created in Kafka

4. Attach to the topic `avscan.action.scan` using Kafka console producer

```
bin/kafka-console-producer.sh --broker-list localhost:9092 --topic avscan.action.scan
```

5. Write the following message to the Console

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:15:05.821Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0502","url":"https://www.dropbox.com/s/31idvhiz9l7v35k/EICAR_submission.zip?dl=1","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0502.zip"}}
```

6. File in the above URL is an infected submission, hence the following message will be posted to Bus API

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:15:05.821Z","mime-type":"application/json","payload":{"status":"scanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0502","url":"https://www.dropbox.com/s/31idvhiz9l7v35k/EICAR_submission.zip?dl=1","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0502.zip","isInfected":true}}
```

7. Write the following message to the Console

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"unscanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://drive.google.com/file/d/16kkvI-itLYaH8IuVDrLsRL94t-HK1w19/view?usp=sharing","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip"}}
```


8. File in the above URL is a clean submission, hence the following message will be posted to Bus API

```
{"topic":"avscan.action.scan","originator":"av-scanner-service","timestamp":"2018-09-19T12:12:28.434Z","mime-type":"application/json","payload":{"status":"scanned","submissionId":"a12a4180-65aa-42ec-a945-5fd21dec0503","url":"https://drive.google.com/file/d/16kkvI-itLYaH8IuVDrLsRL94t-HK1w19/view?usp=sharing","fileName":"a12a4180-65aa-42ec-a945-5fd21dec0503.zip","isInfected":false}}
```

Token Commit.
