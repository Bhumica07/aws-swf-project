

TIMELINE — what the DynamoDB record looks like as the workflow runs
═══════════════════════════════════════════════════════════════════════

node starter.js
      │
      ├─── createOrder() ──────────► { status: "STARTED", steps: {} }
      │
      ▼
SWF starts, decider wakes up, schedules checkStock
      │
      ├─── updateStep()  ──────────► { status: "STOCK_CHECKED",
      │    (checkStock)                steps: { STOCK_CHECKED: {...} } }
      │
      ▼
decider wakes up, schedules chargePayment
      │
      ├─── updateStep()  ──────────► { status: "PAYMENT_CHARGED",
      │    (chargePayment)             steps: { STOCK_CHECKED: {...},
      │                                         PAYMENT_CHARGED: {...} } }
      │
      ▼
decider wakes up, schedules sendConfirmation
      │
      ├─── updateStep()  ──────────► { status: "CONFIRMATION_SENT",
      │    (sendConfirmation)          steps: { STOCK_CHECKED: {...},
      │                                         PAYMENT_CHARGED: {...},
      │                                         CONFIRMATION_SENT: {...} } }
      │
      ▼
decider wakes up, sees all 3 done
      │
      └─── completeOrder() ────────► { status: "COMPLETED" }
                                      ← this is what the React app reads


WHICH FILE USES WHICH FUNCTION
═══════════════════════════════════════════════════════════════════════

starter.js                →  createOrder()
workers/checkStock.js     →  updateStep()
workers/chargePayment.js  →  updateStep()
workers/sendConfirmation  →  updateStep()
decider.js                →  completeOrder()

                             getOrder()  ← not used yet, reserved for
                                            Phase 3 API Lambda to read
                                            the record and return it
                                            to the React frontend
