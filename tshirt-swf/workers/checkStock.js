// workers/checkStock.js
//require('dotenv').config({ path: '../.env' });
const AWS = require('aws-sdk');
const { updateStep } = require('../db');
const config = require('../config');

//#const credentials = new AWS.SharedIniFileCredentials({
//#  profile: config.profile
//#});
//#AWS.config.credentials = credentials;

AWS.config.update({
  region: config.region,
  credentials: new AWS.ECSCredentials({
    httpOptions: { timeout: 5000 },
    maxRetries: 10
  })
});

const swf = new AWS.SWF({
  region: config.region
});

console.log('📦 checkStock worker started — polling for tasks...');

async function pollForTasks() {
  while (true) {
    try {
      console.log('\n⏳ Polling ORDER-ACTIVITY task list...');

      const response = await swf.pollForActivityTask({
        domain: config.domain,
        taskList: { name: config.activities.checkStock.taskList },
        identity: 'checkStock-worker-1'
      }).promise();

      // No task yet — poll again
      if (!response.taskToken) {
        console.log('💤 No task yet — polling again...');
        continue;
      }

      // Got a task — parse the input
      const input = JSON.parse(response.input);
      console.log('\n📬 Got checkStock task!');
      console.log('Input:', input);

      // Simulate checking stock
      // In a real app this would call your database or inventory API
      console.log('🔍 Checking stock for:', input.item, input.size, input.color);
      await new Promise(resolve => setTimeout(resolve, 1000)); // simulate work

      const stockResult = {
        available: true,
        quantity: 42,
        item: input.item,
        size: input.size,
        color: input.color,
        warehouse: 'US-EAST'
      };

      console.log('✅ Stock check complete:', stockResult);

      const orderId = response.workflowExecution.workflowId;
      await updateStep(orderId, 'STOCK_CHECKED', { stockResult });
      console.log('💾 DynamoDB updated → STOCK_CHECKED');

      // Tell SWF this activity completed successfully
      await swf.respondActivityTaskCompleted({
        taskToken: response.taskToken,
        result: JSON.stringify(stockResult)
      }).promise();

      console.log('📤 Result sent back to SWF — decider will now schedule chargePayment');

    } catch (err) {
      console.error('❌ checkStock error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollForTasks();
