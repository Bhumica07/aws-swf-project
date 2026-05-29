#!/bin/bash
# deploy.sh — builds and deploys the React app to S3

BUCKET="tshirt-website-$(date +%s)"
REGION="us-east-1"
PROFILE="default"

echo "🪣 Step 1 — Create S3 bucket: $BUCKET"
aws s3api create-bucket \
  --bucket $BUCKET \
  --region $REGION \
  --profile $PROFILE

echo "🔓 Step 2 — Disable block public access"
aws s3api put-public-access-block \
  --bucket $BUCKET \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
  --profile $PROFILE

echo "📜 Step 3 — Set bucket policy (public read)"
aws s3api put-bucket-policy \
  --bucket $BUCKET \
  --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Sid\": \"PublicReadGetObject\",
      \"Effect\": \"Allow\",
      \"Principal\": \"*\",
      \"Action\": \"s3:GetObject\",
      \"Resource\": \"arn:aws:s3:::$BUCKET/*\"
    }]
  }" \
  --profile $PROFILE

echo "🌐 Step 4 — Enable static website hosting"
aws s3api put-bucket-website \
  --bucket $BUCKET \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "index.html"}
  }' \
  --profile $PROFILE

echo "📦 Step 5 — Build React app"
npm run build

echo "🚀 Step 6 — Upload to S3"
aws s3 sync dist/ s3://$BUCKET \
  --delete \
  --profile $PROFILE

echo ""
echo "✅ Done!"
echo "🌍 Website URL:"
echo "   http://$BUCKET.s3-website-$REGION.amazonaws.com"
