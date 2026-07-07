// decider.js
//require('dotenv').config();
const AWS = require('aws-sdk');
const { completeOrder } = require('./db');
const config = require('./config');

// Use ECS task role credentials explicitly
AWS.config.update({
  region: config.region,
  credentials: new AWS.ECSCredentials({
    httpOptions: { timeout: 5000 },
    maxRetries: 10
  })
});

//#const credentials = new AWS.SharedIniFileCredentials({
//#  profile: config.profile
//#});
//#AWS.config.credentials = credentials;

const swf = new AWS.SWF({
  region: config.region
});

console.log('🧠 Decider started — polling for decision tasks...');
console.log('Domain:', config.domain);
console.log('Task List:', config.workflow.taskList);

function getCompletedActivities(events) {
  const completed = [];

  for (const event of events) {
    if (event.eventType === 'ActivityTaskCompleted') {
      const scheduledEventId =
        event.activityTaskCompletedEventAttributes.scheduledEventId;

      const scheduledEvent = events.find(
        e => e.eventId === scheduledEventId
      );

      if (scheduledEvent) {
        const activityName =
          scheduledEvent
          .activityTaskScheduledEventAttributes
          .activityType
          .name;

        completed.push(activityName);
        console.log('✅ Already completed:', activityName);
      }
    }
  }

  return completed;
}

async function decide(decisionTask) {
  const events = decisionTask.events;
  const completed = getCompletedActivities(events);
  const decisions = [];

  console.log('\n📋 Making decision...');
  console.log('Completed so far:', completed);

  if (!completed.includes(config.activities.checkStock.name)) {
    console.log('👉 Scheduling:', config.activities.checkStock.name);
    decisions.push({
      decisionType: 'ScheduleActivityTask',
      scheduleActivityTaskDecisionAttributes: {
        activityType: {
          name: config.activities.checkStock.name,
          version: config.activities.checkStock.version
        },
        activityId: 'checkStock-' + Date.now(),
        taskList: { name: config.activities.checkStock.taskList },
        input: JSON.stringify({ item: 'tshirt', size: 'M', color: 'blue' })
      }
    });

  } else if (!completed.includes(config.activities.chargePayment.name)) {
    console.log('👉 Scheduling:', config.activities.chargePayment.name);
    decisions.push({
      decisionType: 'ScheduleActivityTask',
      scheduleActivityTaskDecisionAttributes: {
        activityType: {
          name: config.activities.chargePayment.name,
          version: config.activities.chargePayment.version
        },
        activityId: 'chargePayment-' + Date.now(),
        taskList: { name: config.activities.chargePayment.taskList },
        input: JSON.stringify({ amount: 29.99, currency: 'USD', cardToken: 'tok_test_123' })
      }
    });

  } else if (!completed.includes(config.activities.sendConfirmation.name)) {
    console.log('👉 Scheduling:', config.activities.sendConfirmation.name);
    decisions.push({
      decisionType: 'ScheduleActivityTask',
      scheduleActivityTaskDecisionAttributes: {
        activityType: {
          name: config.activities.sendConfirmation.name,
          version: config.activities.sendConfirmation.version
        },
        activityId: 'sendConfirmation-' + Date.now(),
        taskList: { name: config.activities.sendConfirmation.taskList },
        input: JSON.stringify({ email: 'customer@example.com', orderId: 'ORD-001' })
      }
    });

  } else {
    console.log('🎉 All activities complete — closing workflow!');

    // ── Write COMPLETED to DynamoDB ────────────────────────────
    const orderId = decisionTask.workflowExecution.workflowId;
    await completeOrder(orderId);
    console.log('💾 DynamoDB updated → COMPLETED');
    // ──────────────────────────────────────────────────────────

    decisions.push({
      decisionType: 'CompleteWorkflowExecution',
      completeWorkflowExecutionDecisionAttributes: {
        result: JSON.stringify({
          status: 'ORDER_COMPLETE',
          message: 'T-shirt order fulfilled successfully'
        })
      }
    });
  }

  return decisions;
}

async function pollForDecisions() {
  while (true) {
    try {
      console.log('\n⏳ Polling for decision task...');

      const response = await swf.pollForDecisionTask({
        domain: config.domain,
        taskList: { name: config.workflow.taskList },
        identity: 'local-decider-1'
      }).promise();

      if (!response.taskToken) {
        console.log('💤 No decision task yet — polling again...');
        continue;
      }

      console.log('📬 Got decision task! WorkflowId:',
        response.workflowExecution.workflowId);

      const decisions = await decide(response);

      await swf.respondDecisionTaskCompleted({
        taskToken: response.taskToken,
        decisions: decisions
      }).promise();

      console.log('📤 Decisions sent back to SWF');

    } catch (err) {
      console.error('❌ Decider error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

pollForDecisions();
