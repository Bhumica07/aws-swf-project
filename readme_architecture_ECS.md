CURRENT (local)              ECS EQUIVALENT
═══════════════════════════════════════════════════════════════════════

node decider.js          →   ECS Task Definition: tshirt-decider
                             Container: node decider.js
                             Always running (ECS Service, desired=1)

node workers/            →   ECS Task Definition: tshirt-workers
  checkStock.js          →   Container 1: node workers/checkStock.js
  chargePayment.js       →   Container 2: node workers/chargePayment.js
  sendConfirmation.js    →   Container 3: node workers/sendConfirmation.js
                             Always running (ECS Service, desired=1)

node starter.js          →   NOT in ECS
                             Replaced by Lambda (startOrder)
                             already done in Phase 3 ✅


HOW ECS WORKS FOR THIS PROJECT
═══════════════════════════════════════════════════════════════════════

ECR (Elastic Container Registry)
  └── tshirt-swf image   ← your Node.js code packed into Docker

ECS Cluster: tshirt-cluster
  ├── Service: tshirt-decider
  │     └── Task Definition: tshirt-decider
  │           └── Container: node decider.js
  │                 runs forever, polls SWF decision tasks
  │
  └── Service: tshirt-workers
        └── Task Definition: tshirt-workers
              ├── Container 1: node workers/checkStock.js
              ├── Container 2: node workers/chargePayment.js
              └── Container 3: node workers/sendConfirmation.js
                    all run forever, poll SWF activity tasks


FULL ARCHITECTURE WITH ECS
═══════════════════════════════════════════════════════════════════════

React (S3+CloudFront)
      │
      ▼
API Gateway
      ├── POST /orders  → Lambda startOrder → DynamoDB + SWF
      └── GET  /orders/{id} → Lambda getOrder → DynamoDB
                                    │
                                    ▼
                              SWF workflow starts
                                    │
                        ┌───────────▼───────────┐
                        │   ECS Cluster          │
                        │                        │
                        │  ┌─────────────────┐   │
                        │  │ tshirt-decider  │   │
                        │  │ (always on)     │◄──┤── polls SWF decisions
                        │  └────────┬────────┘   │
                        │           │ schedules   │
                        │  ┌────────▼────────┐   │
                        │  │ tshirt-workers  │   │
                        │  │ (always on)     │◄──┤── polls SWF activities
                        │  │                 │   │
                        │  │ • checkStock    │   │
                        │  │ • chargePayment │   │
                        │  │ • sendConfirm   │   │
                        │  └────────┬────────┘   │
                        └───────────┼────────────┘
                                    │
                                    ▼
                              DynamoDB updated
                              at each step


WHAT YOU NEED TO BUILD
═══════════════════════════════════════════════════════════════════════

STEP 1 — Dockerfile
─────────────────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "decider.js"]   ← overridden per task definition


STEP 2 — ECR (container registry)
─────────────────────────────────────────────────────
aws ecr create-repository --repository-name tshirt-swf
docker build -t tshirt-swf .
docker tag tshirt-swf:latest ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/tshirt-swf
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/tshirt-swf


STEP 3 — ECS Cluster
─────────────────────────────────────────────────────
aws ecs create-cluster --cluster-name tshirt-cluster


STEP 4 — Task Definitions (2 of them)
─────────────────────────────────────────────────────

tshirt-decider-task
  image:   ECR image above
  command: ["node", "decider.js"]
  env:     AWS_REGION, SWF_DOMAIN etc

tshirt-workers-task
  image:   same ECR image
  containers:
    - command: ["node", "workers/checkStock.js"]
    - command: ["node", "workers/chargePayment.js"]
    - command: ["node", "workers/sendConfirmation.js"]


STEP 5 — ECS Services (keeps tasks always running)
─────────────────────────────────────────────────────

aws ecs create-service \
  --cluster tshirt-cluster \
  --service-name tshirt-decider \
  --task-definition tshirt-decider-task \
  --desired-count 1              ← always 1 decider running

aws ecs create-service \
  --cluster tshirt-cluster \
  --service-name tshirt-workers \
  --task-definition tshirt-workers-task \
  --desired-count 1              ← always 1 set of workers running


BENEFIT OF ECS SERVICES
═══════════════════════════════════════════════════════════════════════

Auto-restart    →  if decider crashes ECS restarts it automatically
Scaling         →  set desired-count=3 to run 3 parallel worker sets
Logging         →  all console.log goes to CloudWatch automatically
No SSH needed   →  no Mac running, works 24/7
Cost            →  Fargate ~$0.02/hr for these small tasks
Health checks   →  ECS knows if a container dies


COMPARED TO NOW
═══════════════════════════════════════════════════════════════════════

NOW                          ECS
────────────────────         ────────────────────────────────
Your Mac must be on     →    Runs in AWS 24/7
4 terminal tabs         →    2 ECS services
Manual restart          →    Auto-restart on crash
No logging              →    CloudWatch logs
Can't scale             →    desired-count = N workers





