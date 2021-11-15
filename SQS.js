/* eslint-disable no-underscore-dangle */
const aws = require('aws-sdk');

class SQS {
  constructor({
    region = 'us-east-1', accessKey, secret, queueUrl,
  }) {
    this.sqs = new aws.SQS({
      region,
      accessKeyId: accessKey,
      secretAccessKey: secret,
    });
    this.queueUrl = queueUrl;
    this.messages = [];
    this.startQueue();
  }

  send(object) {
    return this.sqs.sendMessage({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(object),
    }).promise();
  }

  pull({ maxMessages = 10, maxWaitSeconds = 20 } = {}) {
    return this.sqs.receiveMessage({
      QueueUrl: this.queueUrl,
      ...(maxMessages && { MaxNumberOfMessages: maxMessages }),
      ...(maxWaitSeconds && { WaitTimeSeconds: maxWaitSeconds }),
    }).promise();
  }

  multiPull({ concurrent = 100 }) {
    return Promise.all(Array(concurrent).fill(0).map(() => this.pull()));
  }

  delete(receiptId) {
    return this.sqs.deleteMessage({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptId,
    }).promise();
  }

  deleteBatch(receiptIds = []) {
    if(receiptIds.length > 10) {
      throw new Error('max 10 ids per delete batch');
    }
    let i = 0;
    const entries = receiptIds.map((rId) => {
      i += 1;
      return { Id: `${i}`, ReceiptHandle: rId };
    });
    return this.sqs.deleteMessageBatch({ QueueUrl: this.queueUrl, Entries: entries }).promise();
  }

  deleteLargeBatch(receiptIds = []) {
    const promises = [];
    for(let i = 0; i < receiptIds.length; i += 10) {
      promises.push(this.deleteBatch(receiptIds.slice(i, i + 10)));
    }
    return Promise.all(promises);
  }

  queueSend(object) {
    this.messages.push(object);
    if(this.messages.length >= 10) {
      this._sendQueue();
    }
  }

  startQueue() {
    if(this.interval) {
      return;
    }
    this.interval = setInterval(() => this._sendQueue(), 10 * 1000);
  }

  stopQueue() {
    clearInterval(this.interval);
    this.interval = null;
  }

  restartQueue() {
    if(this.interval) {
      this.stopQueue();
      this.startQueue();
    }
  }

  addQueueSendListener(cb) {
    this.cb = cb;
  }

  _sendQueue() {
    if(!this.messages || !this.messages.length) {
      return;
    }
    // max batch size is 10
    const toProcess = this.messages.splice(0, 10);
    let i = 0;
    const entries = toProcess.map((mes) => {
      i += 1;
      return { Id: `${i}`, MessageBody: JSON.stringify(mes) };
    });
    this.restartQueue();
    this.sqs
      .sendMessageBatch({ QueueUrl: this.queueUrl, Entries: entries })
      .promise()
      .then((response) => {
        if(this.cb) {
          this.cb(null, { response, messages: toProcess });
        }
      })
      .catch((err) => {
        if(this.cb) {
          this.cb(err);
        }
      });
  }
}

module.exports = SQS;

const clients = {};
/** @returns SQS */
module.exports.getClient = ({
  region = 'us-east-1', accessKey, secret, queueUrl,
}) => {
  const key = `${region}-${queueUrl}-${accessKey}-${secret}`;
  if(!clients[key]) {
    clients[key] = new SQS({
      region, accessKey, secret, queueUrl,
    });
  }
  return clients[key];
};
