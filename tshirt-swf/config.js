require('dotenv').config();   // ← loads .env file automatically

const config = {
  region: process.env.AWS_REGION,
  profile: process.env.AWS_PROFILE,

  domain: "tshirt-swf",

  taskList: {
    order: "ORDER-ACTIVITY",
    payment: "PAYMENTS-ACTIVITY",
    notification: "EMAIL-ACTIVITY"
  },

  workflow: {
    name: "OrderFulfillmentWorkflow",
    version: "1.0",
    taskList: "ORDER-DECISION"
  },

  activities: {
    checkStock: {
      name: "InventoryActivities.checkStock",
      version: "1.0",
      taskList: "ORDER-ACTIVITY"
    },
    chargePayment: {
      name: "PaymentActivities.chargePayment",
      version: "1.0",
      taskList: "PAYMENTS-ACTIVITY"
    },
    sendConfirmation: {
      name: "NotificationActivities.sendConfirmation",
      version: "1.0",
      taskList: "EMAIL-ACTIVITY"
    }
  }
};

module.exports = config;
