// workers/chargePayment.js
require('dotenv').config({ path: '../.env' });
const AWS = require('aws-sdk');
const { updateStep } = require('../db');
const config = require('../config');

const credentials = new AWS.SharedIniFileCredentials({
  profile: config.profile
});
AWS.config.credentials = credentials;

const swf = new AWS.SWF({
  region: config.region
});

console.log('💳 chargePayment worker started — polling for tasks...');

async function pollForTasks() {
  while (true) {
    try {
      console.log('\n⏳ Polling PAYMENTS-ACTIVITY task list...');

      const response = await swf.pollForActivityTask({
        domain: config.domain,
        taskList: { name: config.activities.chargePayment.taskList },
        identity: 'chargePayment-worker-1'
      }).promise();

      // No task yet — poll again
      if (!response.taskToken) {
        console.log('💤 No task yet — polling again...');
        continue;
      }

      // Got a task — parse the input
      const input = JSON.parse(response.input);
      console.log('\n📬 Got chargePayment task!');
      console.log('Input:', input);

      // Simulate charging payment
      // In a real app this would call Stripe, Braintree etc.
      console.log('💰 Charging:', input.amount, input.currency);
      console.log('💳 Card token:', input.cardToken);
      await new Promise(resolve => setTimeout(resolve, 1500)); // simulate work

      const paymentResult = {
        success: true,
        transactionId: 'TXN-' + Date.now(),
        amount: input.amount,
        currency: input.currency,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Payment complete:', paymentResult);
      const orderId = response.workflowExecution.workflowId;
      await updateStep(orderId, 'PAYMENT_CHARGED', { paymentResult });
      console.log('💾 DynamoDB updated → PAYMENT_CHARGED');

      // Tell SWF this activity completed successfully
      await swf.respondActivityTaskCompleted({
        taskToken: response.taskToken,
        result: JSON.stringify(paymentResult)
      }).promise();

      console.log('📤 Result sent back to SWF — decider will now schedule sendConfirmation');

    } catch (err) {
      console.error('❌ chargePayment error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollForTasks();
