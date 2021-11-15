# sqs-client
a simple to use AWS SQS client wrapper/abstraction.

## Installation
```npm i --save @purpleads/sqs-client```

## Usage
```js
const sqs = require('@purplads/sqs-client').getClient({ 
  region: 'us-east-1', accessKey, secret, queueUrl,
});

// send a message to queue (javascript object turned to JSON string)
await sqs.send({ key: 'value' });

/**
 * queue send
 * queue waits for 10 messages to be sent 
 * or every 10 seconds to decrease number of requests to sqs
 */
await sqs.queueSend({ message: '1234' });

// you can also add a send listener
sqs.addQueueSendListener((err, { response, messages} = {}) => {
  if(err) {
    console.error('failed sending);
  } else {
    console.log('queue sent', messages.length);
  }
});

// pull messages
const { Messages } await sqs.pull({ maxMessages: 10, maxWaitSeconds: 20 }) || {};
const message = Messages && Messages[0];

// delete messages when done
await sqs.delete(message.ReceiptHandle);
// or batch delete (supports deleting any number of messages)
await sqs.deleteLargeBatch(messages.map((m) => m.ReceiptHandle));

```