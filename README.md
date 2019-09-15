# Secret Hitler Role Bot

A chatbot that allows users to allocate roles for the board game Secret Hitler, using the AWS serverless platform.

Currently has integrations for Facebook Messenger and Telegram, and uses AWS Lambda, DynamoDB and CloudFormation. Can deploy seperately to segregated dev and prod environments.

## Dependencies

Install Serverless:
```
npm install -g serverless
```

## Installation

Deploy:
```
serverless deploy -v
```

## Uninstallation

```
serverless remove
```
