// db.js
const AWS = require('aws-sdk');
const config = require('./config');

//const credentials = new AWS.SharedIniFileCredentials({
//  profile: config.profile
//});
//AWS.config.credentials = credentials;

AWS.config.update({
  region: config.region,
  credentials: new AWS.ECSCredentials({
    httpOptions: { timeout: 5000 },
    maxRetries: 10
  })
});

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: config.region
});

const TABLE = 'tshirt-orders';

async function createOrder(orderId, orderData) {
  await dynamo.put({
    TableName: TABLE,
    Item: {
      orderId,
      status: 'STARTED',
      steps: {},
      orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }).promise();
}

async function updateStep(orderId, stepName, result) {
  await dynamo.update({
    TableName: TABLE,
    Key: { orderId },
    UpdateExpression:
      'SET #steps.#step = :result, #status = :status, updatedAt = :now',
    ExpressionAttributeNames: {
      '#steps': 'steps',
      '#step':  stepName,
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':result': { completedAt: new Date().toISOString(), ...result },
      ':status': stepName,
      ':now':    new Date().toISOString(),
    }
  }).promise();
}

async function completeOrder(orderId) {
  await dynamo.update({
    TableName: TABLE,
    Key: { orderId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'COMPLETED',
      ':now':    new Date().toISOString(),
    }
  }).promise();
}

async function getOrder(orderId) {
  const result = await dynamo.get({
    TableName: TABLE,
    Key: { orderId }
  }).promise();
  return result.Item || null;
}

module.exports = { createOrder, updateStep, completeOrder, getOrder };
