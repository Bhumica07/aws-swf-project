# aws-swf-project
buiild a tshirt web site with following, use color theme as wine color + white .

Build a full-stack t-shirt ordering website that triggers an AWS SWF

workflow when a customer places an order.

TECH STACK:

Frontend: React (hosted on S3 + CloudFront)
Backend: Node.js Lambda functions
API: AWS API Gateway
Workflow: AWS SWF
Database: AWS DynamoDB
Auth: None needed for MVP
─────────────────────────────────────────

EXISTING SWF VALUES — USE EXACTLY AS IS

─────────────────────────────────────────

Region:          us-east-1
Domain:          tshirt-swf
Profile:         home (local dev only, use IAM role in Lambda)

Workflow:
  name:          OrderFulfillmentWorkflow
  version:       1.0
  taskList:      ORDER-DECISION

Activities:
  checkStock:
    name:        InventoryActivities.checkStock
    version:     1.0
    taskList:    ORDER-ACTIVITY

  chargePayment:
    name:        PaymentActivities.chargePayment
    version:     1.0
    taskList:    PAYMENTS-ACTIVITY

  sendConfirmation:
    name:        NotificationActivities.sendConfirmation
    version:     1.0
    taskList:    EMAIL-ACTIVITY
─────────────────────────────────────────

DYNAMODB TABLE

─────────────────────────────────────────

Table name: tshirt-orders

Partition key: orderId (String)

Attributes:
orderId String e.g. ORD-1234567890

status String PENDING, PROCESSING, CONFIRMED, FAILED

customerName String

customerEmail String

  item           Map      { type, size, color, quantity }
  payment        Map      { amount, currency, cardToken }
workflowRunId String SWF runId returned on start

createdAt String ISO timestamp

updatedAt String ISO timestamp

─────────────────────────────────────────

FRONTEND REQUIREMENTS

─────────────────────────────────────────

Page 1 — Shop

Show 3 t-shirt products (blue, red, black)
Each has size selector (S, M, L, XL)
Add to cart button
Price: .99 each
Page 2 — Checkout

Customer name field
Customer email field
Mock payment field (card number, no real payment)
Place Order button
On submit: POST /order to API Gateway
Page 3 — Order Confirmation

Show order ID
Show status (poll GET /order/{orderId} every 3 seconds)
Show each step completing in real time:
    ✅ Stock checked
    ✅ Payment processed
    ✅ Confirmation sent
─────────────────────────────────────────

API GATEWAY ENDPOINTS

─────────────────────────────────────────

POST /order

Validates request body
Writes order to DynamoDB with status PENDING
Calls swf.startWorkflowExecution() with existing
    domain and workflow values above
  - Returns { orderId, runId }

GET /order/{orderId}
Reads order status from DynamoDB
Returns full order object
─────────────────────────────────────────

LAMBDA FUNCTIONS

─────────────────────────────────────────

Function 1: startOrder

Triggered by POST /order
Writes to DynamoDB
Starts SWF workflow execution
  - Input: { customerName, customerEmail, item, payment }
Must use IAM role for AWS credentials, not hardcoded keys
Function 2: getOrder

  - Triggered by GET /order/{orderId}
Reads from DynamoDB
Returns order object
─────────────────────────────────────────

ECS WORKERS (already built locally)

─────────────────────────────────────────

These are already running as Node.js processes.

For production wrap each in a Docker container

and deploy to ECS Fargate:

Container 1: decider.js

    - Polls ORDER-DECISION task list
    - Schedules activities in sequence
    - Updates DynamoDB status at each step
Container 2: workers/checkStock.js

    - Polls ORDER-ACTIVITY
    - Checks inventory
    - Updates DynamoDB status to PROCESSING
Container 3: workers/chargePayment.js

    - Polls PAYMENTS-ACTIVITY
    - Processes payment
    - Updates DynamoDB status
Container 4: workers/sendConfirmation.js

    - Polls EMAIL-ACTIVITY
    - Sends confirmation via SES
    - Updates DynamoDB status to CONFIRMED
─────────────────────────────────────────

ENVIRONMENT VARIABLES FOR LAMBDA

─────────────────────────────────────────

SWF_DOMAIN=tshirt-swf
SWF_WORKFLOW_NAME=OrderFulfillmentWorkflow
SWF_WORKFLOW_VERSION=1.0
SWF_TASKLIST=ORDER-DECISION
DYNAMODB_TABLE=tshirt-orders
AWS_REGION=us-east-1
─────────────────────────────────────────

WHAT TO GENERATE

─────────────────────────────────────────

React frontend (all three pages)
Lambda function startOrder (Node.js)
Lambda function getOrder (Node.js)
API Gateway config (SAM or CDK template)
DynamoDB table config (CloudFormation or CDK)
Updated decider.js that writes status to DynamoDB
Updated workers that write status to DynamoDB
IAM role policy for Lambda with SWF + DynamoDB access
Docker files for each ECS worker container
README with deployment steps
