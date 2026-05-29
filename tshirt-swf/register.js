require('dotenv').config();
const AWS = require('aws-sdk');
const config = require('./config');

// Tell the SDK which profile to use from ~/.aws/credentials
const credentials = new AWS.SharedIniFileCredentials({ 
  profile: config.profile 
});
AWS.config.credentials = credentials;

// Create the SWF client — this is our connection to AWS SWF
const swf = new AWS.SWF({ 
  region: config.region 
});

console.log('Connecting to AWS SWF...');
console.log('Region:', config.region);
console.log('Profile:', config.profile);


// Register the domain — like creating "US2-FLOWS" in your architecture
async function registerDomain() {
  try {
    await swf.registerDomain({
      name: config.domain,
      workflowExecutionRetentionPeriodInDays: "1"  // keep history for 1 day
    }).promise();
    console.log('✅ Domain registered:', config.domain);
  } catch (err) {
    if (err.code === 'DomainAlreadyExistsFault') {
      console.log('⚠️  Domain already exists, skipping:', config.domain);
    } else {
      throw err;
    }
  }
}

// Register the workflow type — like registering "OrderFulfillmentWorkflow v1.0"
async function registerWorkflow() {
  try {
    await swf.registerWorkflowType({
      domain: config.domain,
      name: config.workflow.name,
      version: config.workflow.version,
      defaultTaskList: { name: config.workflow.taskList },
      defaultExecutionStartToCloseTimeout: "3600",  // 1 hour max for whole workflow
      defaultTaskStartToCloseTimeout: "60"           // 60 sec per decision task
    }).promise();
    console.log('✅ Workflow registered:', config.workflow.name, config.workflow.version);
  } catch (err) {
    if (err.code === 'TypeAlreadyExistsFault') {
      console.log('⚠️  Workflow already exists, skipping:', config.workflow.name);
    } else {
      throw err;
    }
  }
}

// Register all three activity types
async function registerActivities() {
  for (const [key, activity] of Object.entries(config.activities)) {
    try {
      await swf.registerActivityType({
        domain: config.domain,
        name: activity.name,
        version: activity.version,
        defaultTaskList: { name: activity.taskList },
        defaultTaskScheduleToStartTimeout: "300",  // 5 min to pick up task
        defaultTaskStartToCloseTimeout: "60",       // 60 sec to complete task
        defaultTaskScheduleToCloseTimeout: "360",   // 6 min total
        defaultTaskHeartbeatTimeout: "30"           // heartbeat every 30 sec
      }).promise();
      console.log('✅ Activity registered:', activity.name, activity.version);
    } catch (err) {
      if (err.code === 'TypeAlreadyExistsFault') {
        console.log('⚠️  Activity already exists, skipping:', activity.name);
      } else {
        throw err;
      }
    }
  }
}

// Run everything in order
async function main() {
  try {
    await registerDomain();
    await registerWorkflow();
    await registerActivities();
    console.log('\n🎉 Registration complete! Ready to run workflows.');
  } catch (err) {
    console.error('❌ Registration failed:', err.message);
  }
}

main();
