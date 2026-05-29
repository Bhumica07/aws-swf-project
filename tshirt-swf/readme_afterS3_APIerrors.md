API ------


  bhumicasaini@MacBook-Air tshirt-swf % aws apigateway create-rest-api \
  --name tshirt-api \
  --description "T-shirt order API" \
  --region us-east-1 \
  --profile default
{
    "id": "3agxbo2hxh",
    "name": "tshirt-api",
    "description": "T-shirt order API",
    "createdDate": "2026-05-22T02:25:19+05:30",
    "apiKeySource": "HEADER",
    "endpointConfiguration": {
        "types": [
            "EDGE"
        ],
        "ipAddressType": "ipv4"
    },
    "disableExecuteApiEndpoint": false,
    "rootResourceId": "au45jxj9j7"
}
bhumicasaini@MacBook-Air tshirt-swf % 


FINAL STRUCTURE
═══════════════════════════════════════════════════════
/                        root:      au45jxj9j7
└── /orders              resource:  bq985m
      ├── POST           → tshirt-startOrder Lambda
      └── /{orderId}     resource:  1z21do
            └── GET      → tshirt-getOrder Lambda




API GATEWAY — tshirt-api (3agxbo2hxh)
═══════════════════════════════════════════════════════════════════════

Internet / React App
        │
        ▼
https://3agxbo2hxh.execute-api.us-east-1.amazonaws.com/dev
        │
        ├──────────────────────────────────────────────────────────────
        │
        │  POST /orders
        │  resource-id: bq985m
        │  payload: { customer, item, payment }
        │        │
        │        ▼
        │  Lambda: tshirt-startOrder
        │        │
        │        ├──► DynamoDB: creates record  { status: "STARTED" }
        │        │
        │        └──► SWF: starts OrderFulfillmentWorkflow
        │                    │
        │                    ▼
        │             local decider.js picks up
        │                    │
        │                    ├──► checkStock worker
        │                    │         └──► DynamoDB: STOCK_CHECKED
        │                    │
        │                    ├──► chargePayment worker
        │                    │         └──► DynamoDB: PAYMENT_CHARGED
        │                    │
        │                    └──► sendConfirmation worker
        │                              └──► DynamoDB: CONFIRMATION_SENT
        │                                        │
        │                                        ▼
        │                              decider marks COMPLETED
        │
        ├──────────────────────────────────────────────────────────────
        │
        │  GET /orders/{orderId}
        │  resource-id: qpi38t
        │  example: GET /orders/ORD-1779394559419
        │        │
        │        ▼
        │  Lambda: tshirt-getOrder
        │        │
        │        └──► DynamoDB: reads record by orderId
        │                    │
        │                    └──► returns:
        │                           {
        │                             orderId:   "ORD-xxx"
        │                             status:    "COMPLETED"
        │                             steps: {
        │                               STOCK_CHECKED:     { ... }
        │                               PAYMENT_CHARGED:   { ... }
        │                               CONFIRMATION_SENT: { ... }
        │                             }
        │                           }
        │
        └──────────────────────────────────────────────────────────────


ENDPOINTS SUMMARY
═══════════════════════════════════════════════════════════════════════

METHOD   PATH                  LAMBDA               ACTION
──────   ────────────────────  ───────────────────  ──────────────────
POST     /orders               tshirt-startOrder    create order + SWF
GET      /orders/{orderId}     tshirt-getOrder      read order status


WHAT REACT APP WILL DO
═══════════════════════════════════════════════════════════════════════

1. User fills form and clicks "Order"
        │
        ▼
2. POST /orders  →  gets back orderId
        │
        ▼
3. Poll GET /orders/{orderId} every 2 seconds
        │
        ▼
4. Show live progress as status changes:
   STARTED → STOCK_CHECKED → PAYMENT_CHARGED → CONFIRMATION_SENT → COMPLETED





Step 1 — Create the API
bashaws apigateway create-rest-api \
  --name tshirt-api \
  --description "T-shirt order API" \
  --region us-east-1 \
  --profile default
Copy the id value from the output — this is your API_ID. Looks like: abc123def

Step 2 — Get the root resource ID
bashaws apigateway get-resources \
  --rest-api-id YOUR_API_ID \
  --region us-east-1 \
  --profile default
Copy the id where path is / — this is your ROOT_ID.

Step 3 — Create /orders resource
bashaws apigateway create-resource \
  --rest-api-id YOUR_API_ID \
  --parent-id YOUR_ROOT_ID \
  --path-part orders \
  --region us-east-1 \
  --profile default
Copy the id from output — this is your ORDERS_ID.

Step 4 — Create /orders/{orderId} resource
bashaws apigateway create-resource \
  --rest-api-id YOUR_API_ID \
  --parent-id YOUR_ORDERS_ID \
  --path-part "{orderId}" \
  --region us-east-1 \
  --profile default
Copy the id from output — this is your ORDER_ID_ID.

Step 5 — Create POST method on /orders
bashaws apigateway put-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_ORDERS_ID \
  --http-method POST \
  --authorization-type NONE \
  --region us-east-1 \
  --profile default

Step 6 — Create GET method on /orders/{orderId}
bashaws apigateway put-method \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_ORDER_ID_ID \
  --http-method GET \
  --authorization-type NONE \
  --region us-east-1 \
  --profile default

Step 7 — Wire POST /orders to startOrder Lambda
bashaws apigateway put-integration \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_ORDERS_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:125474112936:function:tshirt-startOrder/invocations \
  --region us-east-1 \
  --profile default

Step 8 — Wire GET /orders/{orderId} to getOrder Lambda
bashaws apigateway put-integration \
  --rest-api-id YOUR_API_ID \
  --resource-id YOUR_ORDER_ID_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:125474112936:function:tshirt-getOrder/invocations \
  --region us-east-1 \
  --profile default

Step 9 — Give API Gateway permission to invoke both Lambdas
bashaws lambda add-permission \
  --function-name tshirt-startOrder \
  --statement-id apigateway-startOrder \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:125474112936:YOUR_API_ID/*/POST/orders" \
  --region us-east-1 \
  --profile default

aws lambda add-permission \
  --function-name tshirt-getOrder \
  --statement-id apigateway-getOrder \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:125474112936:YOUR_API_ID/*/GET/orders/*" \
  --region us-east-1 \
  --profile default

Step 10 — Deploy the API
bashaws apigateway create-deployment \
  --rest-api-id YOUR_API_ID \
  --stage-name dev \
  --region us-east-1 \
  --profile default
Your API is now live at:
https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/dev

Step 11 — Test with curl
bash# Test POST — start a new order
curl -X POST \
  https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/dev/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": { "name": "John Smith", "email": "john@test.com" },
    "item": { "type": "tshirt", "size": "M", "color": "blue", "quantity": 1 },
    "payment": { "amount": 29.99, "currency": "USD", "cardToken": "tok_test_123" }
  }'

# Test GET — fetch order status
curl https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/dev/orders/ORD-XXXX
