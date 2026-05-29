// lambda/getOrder.js
const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE  = 'tshirt-orders';

exports.handler = async (event) => {
  const orderId = event.pathParameters?.orderId;

  if (!orderId) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'orderId is required' })
    };
  }

  try {
    const result = await dynamo.get({
      TableName: TABLE,
      Key: { orderId }
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(result.Item)
    };

  } catch (err) {
    console.error('getOrder error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message })
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'    // tighten this to your domain later
  };
}
