tshirt-swf/
├── workers/
│      ├── checkStock.js                  ✅
│      ├── chargePayment.js            ✅
│      └── sendConfirmation.js      ✅
├── .env                                            ✅
├── .gitignore                                ✅
├── config.js                                  ✅
├── decider.js                                ✅
├── register.js                              ✅
├── starter.js                                ✅
├── package.json                            ✅
└── package-lock.json                  ✅



# Tab 1
node decider.js

# Tab 2
node workers/checkStock.js

# Tab 3
node workers/chargePayment.js

# Tab 4
node workers/sendConfirmation.js

# Tab 5 — run this last after all workers are polling
node starter.js




Result ----

Starter : 

🛒 Starting new t-shirt order...
Order: {
    orderId: 'ORD-1234567890',
    customer: { name: 'John Smith', email: 'customer@example.com' },
    item: { type: 'tshirt', size: 'M', color: 'blue', quantity: 1 },
    payment: { amount: 29.99, currency: 'USD', cardToken: 'tok_test_123' }
}
✅ Workflow started successfully!
WorkflowId: ORD-1234567890
RunId: 22TiFNs...
👀 Watch your decider and worker terminals to see the flow execute!

decider : 

📬 Got decision task! WorkflowId: ORD-1234567890
📋 Making decision...
Completed so far: []
👉 Scheduling: InventoryActivities.checkStock
📤 Decisions sent back to SWF


checkstock : 

📬 Got checkStock task!
Input: { item: 'tshirt', size: 'M', color: 'blue' }
🔍 Checking stock for: tshirt M blue
✅ Stock check complete: { available: true, quantity: 42... }
📤 Result sent back to SWF — decider will now schedule chargePayment



decider.js lights up again

📬 Got decision task! WorkflowId: ORD-1234567890
📋 Making decision...
✅ Already completed: InventoryActivities.checkStock
👉 Scheduling: PaymentActivities.chargePayment
📤 Decisions sent back to SWF



chargePayment.js lights up third


📬 Got chargePayment task!
💰 Charging: 29.99 USD
💳 Card token: tok_test_123
✅ Payment complete: { transactionId: 'TXN-...' }
📤 Result sent back to SWF — decider will now schedule sendConfirmation


Tab 1 — decider.js lights up again


✅ Already completed: InventoryActivities.checkStock
✅ Already completed: PaymentActivities.chargePayment
👉 Scheduling: NotificationActivities.sendConfirmation
📤 Decisions sent back to SWF



ab 4 — sendConfirmation.js lights up last


📬 Got sendConfirmation task!
📧 Sending confirmation to: customer@example.com
📦 Order ID: ORD-1234567890
✅ Confirmation sent: { messageId: 'MSG-...' }
📤 Result sent back to SWF — decider will now close the workflow!


Tab 1 — decider.js closes the workflow


✅ Already completed: InventoryActivities.checkStock
✅ Already completed: PaymentActivities.chargePayment
✅ Already completed: NotificationActivities.sendConfirmation
🎉 All activities complete — closing workflow!
📤 Decisions sent back to SWF





node starter.js
            │
            ▼
SWF created workflow execution ORD-001
            │
            ▼
Tab 1 decider.js woke up
            └── history empty → scheduled checkStock
            │
            ▼
Tab 2 checkStock.js picked up task
            └── simulated stock check → responded completed
            │
            ▼
Tab 1 decider.js woke up again
            └── saw checkStock done → scheduled chargePayment
            │
            ▼
Tab 3 chargePayment.js picked up task
            └── simulated payment → responded completed
            │
            ▼
Tab 1 decider.js woke up again
            └── saw chargePayment done → scheduled sendConfirmation
            │
            ▼
Tab 4 sendConfirmation.js picked up task    ← you are here ✅
            └── simulated email → responded completed
            │
            ▼
Tab 1 decider.js woke up one final time
            └── saw all three done → CompleteWorkflowExecution 🎉


AWS Console
└── SWF
            └── Domains
                        └── tshirt-swf
                                    └── Workflow Executions
                                                └── Closed Executions
                                                            └── ORD-001      ← look for this
                                                                        Status: COMPLETED ✅
                                                                        └── Event History
                                                                                    WorkflowExecutionStarted
                                                                                    DecisionTaskScheduled
                                                                                    DecisionTaskCompleted
                                                                                    ActivityTaskScheduled → checkStock
                                                                                    ActivityTaskCompleted → checkStock
                                                                                    ActivityTaskScheduled → chargePayment
                                                                                    ActivityTaskCompleted → chargePayment
                                                                                    ActivityTaskScheduled → sendConfirmation
                                                                                    ActivityTaskCompleted → sendConfirmation
                                                                                    WorkflowExecutionCompleted 🎉





Phase 1 — SWF Core                  ✅ COMPLETE
─────────────────────────────────────
config.js                                    ✅
register.js                                ✅
decider.js                                  ✅
workers/checkStock.js            ✅
workers/chargePayment.js      ✅
workers/sendConfirmation.js✅
starter.js                                  ✅

Phase 2 — Data Layer              ← next
─────────────────────────
DynamoDB table
Lambda function

Phase 3 — API Layer
─────────────────────────
API Gateway
Lambda

Phase 4 — Frontend
─────────────────────────
React app
S3 + CloudFront
ACM certificate

You have a working SWF engine. Everything from Phase 2 onwards is just plugging things into it. Want to move on to Phase 2 and add DynamoDB to persist order status?







