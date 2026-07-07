// workers/sendConfirmation.js
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

console.log('📧 sendConfirmation worker started — polling for tasks...');

async function pollForTasks() {
  while (true) {
    try {
      console.log('\n⏳ Polling EMAIL-ACTIVITY task list...');

      const response = await swf.pollForActivityTask({
        domain: config.domain,
        taskList: { name: config.activities.sendConfirmation.taskList },
        identity: 'sendConfirmation-worker-1'
      }).promise();

      // No task yet — poll again
      if (!response.taskToken) {
        console.log('💤 No task yet — polling again...');
        continue;
      }

      // Got a task — parse the input
      const input = JSON.parse(response.input);
      console.log('\n📬 Got sendConfirmation task!');
      console.log('Input:', input);

      // Simulate sending confirmation email
      // In a real app this would call SES, SendGrid etc.
      console.log('📧 Sending confirmation to:', input.email);
      console.log('📦 Order ID:', input.orderId);
      await new Promise(resolve => setTimeout(resolve, 1000)); // simulate work

      const confirmationResult = {
        success: true,
        messageId: 'MSG-' + Date.now(),
        email: input.email,
        orderId: input.orderId,
        sentAt: new Date().toISOString()
      };

      console.log('✅ Confirmation sent:', confirmationResult);

      const orderId = response.workflowExecution.workflowId;
      await updateStep(orderId, 'CONFIRMATION_SENT', { confirmationResult });
      console.log('💾 DynamoDB updated → CONFIRMATION_SENT');

      // Tell SWF this activity completed successfully
      await swf.respondActivityTaskCompleted({
        taskToken: response.taskToken,
        result: JSON.stringify(confirmationResult)
      }).promise();

      console.log('📤 Result sent back to SWF — decider will now close the workflow!');

    } catch (err) {
      console.error('❌ sendConfirmation error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollForTasks();
