// lambda/startOrder.js
const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();
const swf    = new AWS.SWF({ region: process.env.AWS_REGION || 'us-east-1' });

const TABLE         = 'tshirt-orders';
const DOMAIN        = process.env.SWF_DOMAIN;
const WORKFLOW_NAME = process.env.SWF_WORKFLOW_NAME;
const WORKFLOW_VER  = process.env.SWF_WORKFLOW_VERSION;
const TASK_LIST     = process.env.SWF_TASK_LIST;

exports.handler = async (event) => {
  try {
    const body  = JSON.parse(event.body || '{}');

    const order = {
      orderId:  'ORD-' + Date.now(),
      customer: body.customer,
      item:     body.item,
      payment:  body.payment,
    };

    // 1. Write to DynamoDB first
    await dynamo.put({
      TableName: TABLE,
      Item: {
        orderId:   order.orderId,
        status:    'STARTED',
        steps:     {},
        orderData: order,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }).promise();

    // 2. Start SWF workflow
    const response = await swf.startWorkflowExecution({
      domain:     DOMAIN,
      workflowId: order.orderId,
      workflowType: {
        name:    WORKFLOW_NAME,
        version: WORKFLOW_VER
      },
      taskList: { name: TASK_LIST },
      input:    JSON.stringify(order),
      executionStartToCloseTimeout: '3600',
    }).promise();

    return {
      statusCode: 201,
      headers: corsHeaders(),
      body: JSON.stringify({
        orderId: order.orderId,
        runId:   response.runId,
        status:  'STARTED'
      })
    };

  } catch (err) {
    console.error('startOrder error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};


function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
  };
}
