// starter.js — triggers a new workflow execution
// this simulates a customer placing a t-shirt order
require('dotenv').config();
const AWS = require('aws-sdk');
const { createOrder } = require('./db');
const config = require('./config');

const credentials = new AWS.SharedIniFileCredentials({
  profile: config.profile
});
AWS.config.credentials = credentials;

const swf = new AWS.SWF({
  region: config.region
});

async function startOrder() {
  // This is the customer order data
  // In Phase 2 this will come from API Gateway + Lambda
  const orderInput = {
    orderId: 'ORD-' + Date.now(),
    customer: {
      name: 'John Smith',
      email: 'customer@example.com'
    },
    item: {
      type: 'tshirt',
      size: 'M',
      color: 'blue',
      quantity: 1
    },
    payment: {
      amount: 29.99,
      currency: 'USD',
      cardToken: 'tok_test_123'
    }
  };

  console.log('🛒 Starting new t-shirt order...');
  console.log('Order:', JSON.stringify(orderInput, null, 2));
  await createOrder(orderInput.orderId, orderInput);
  console.log('💾 DynamoDB record created for', orderInput.orderId);

  try {
    const response = await swf.startWorkflowExecution({
      domain: config.domain,
      workflowId: orderInput.orderId,        // unique ID for this execution
      workflowType: {
        name: config.workflow.name,
        version: config.workflow.version
      },
      taskList: { 
        name: config.workflow.taskList 
      },
      input: JSON.stringify(orderInput),
      executionStartToCloseTimeout: '3600',
      tagList: [                             // like solutionId/versionId tags
        'source:tshirt-website',             // in your US2-FLOWS diagram
        'env:development'
      ]
    }).promise();

    console.log('\n✅ Workflow started successfully!');
    console.log('WorkflowId:', orderInput.orderId);
    console.log('RunId:', response.runId);
    console.log('\n👀 Watch your decider and worker terminals to see the flow execute!');

  } catch (err) {
    console.error('❌ Failed to start workflow:', err.message);
  }
}

startOrder();
