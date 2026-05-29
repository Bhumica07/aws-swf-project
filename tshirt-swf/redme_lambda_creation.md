# Zip getOrder
zip -j lambda/getOrder.zip lambda/getOrder.js

# Zip startOrder
zip -j lambda/startOrder.zip lambda/startOrder.js

# Deploy getOrder
aws lambda create-function \
  --function-name tshirt-getOrder \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_LAMBDA_ROLE \
  --handler getOrder.handler \
  --zip-file fileb://lambda/getOrder.zip \
  --region us-east-1 \
  --profile your-profile-name

# Deploy startOrder
aws lambda create-function \
  --function-name tshirt-startOrder \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_LAMBDA_ROLE \
  --handler startOrder.handler \
  --zip-file fileb://lambda/startOrder.zip \
  --environment Variables="{
    SWF_DOMAIN=tshirt-swf,
    SWF_WORKFLOW_NAME=TshirtOrderWorkflow,
    SWF_WORKFLOW_VERSION=1.0,
    SWF_TASK_LIST=TshirtDeciderList
  }" \
  --region us-east-1 \
  --profile your-profile-name


  # Get your account ID
aws sts get-caller-identity --profile your-profile-name

# List existing roles (look for one with Lambda permissions)
aws iam list-roles --profile your-profile-name | jq '.Roles[].RoleName'

Step 5 — Test Lambdas directly before touching API Gateway

# Test getOrder
aws lambda invoke \
  --function-name tshirt-getOrder \
  --payload '{"pathParameters":{"orderId":"ORD-XXXX"}}' \
  --cli-binary-format raw-in-base64-out \
  --profile your-profile-name \
  response.json && cat response.json

# Test startOrder
aws lambda invoke \
  --function-name tshirt-startOrder \
  --payload '{
    "body": "{\"customer\":{\"name\":\"John\",\"email\":\"j@test.com\"},\"item\":{\"type\":\"tshirt\",\"size\":\"M\",\"color\":\"blue\",\"quantity\":1},\"payment\":{\"amount\":29.99,\"currency\":\"USD\",\"cardToken\":\"tok_test_123\"}}"
  }' \
  --cli-binary-format raw-in-base64-out \
  --profile your-profile-name \
  response.json && cat response.json




  aws iam create-role \
  --role-name tshirt-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": { "Service": "lambda.amazonaws.com" },
        "Action": "sts:AssumeRole"
      }
    ]
  }' \
  --profile default



  aws iam put-role-policy \
  --role-name tshirt-lambda-role \
  --policy-name tshirt-dynamodb-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ],
        "Resource": "arn:aws:dynamodb:us-east-1:125474112936:table/tshirt-orders"
      }
    ]
  }' \
  --profile default


 


 


 aws lambda update-function-configuration \
  --function-name tshirt-startOrder \
  --environment Variables="{\
    SWF_DOMAIN=tshirt-swf,\
    SWF_WORKFLOW_NAME=OrderFulfillmentWorkflow,\
    SWF_WORKFLOW_VERSION=1.0,\
    SWF_TASK_LIST=ORDER-DECISION\
  }" \
  --region us-east-1 \
  --profile your-profile-name



  test lambda


  aws lambda invoke \
  --function-name tshirt-getOrder \
  --payload '{"pathParameters":{"orderId":"ORD-XXXX"}}' \
  --cli-binary-format raw-in-base64-out \
  --region us-east-1 \
  --profile your-profile-name \
  response.json && cat response.json >>EOF
<< EOF
