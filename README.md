# Secret Hitler Role Bot

A chatbot that allows users to allocate roles for the board game Secret Hitler, using the AWS serverless platform.

Currently has integrations for Facebook Messenger and Telegram, and uses AWS Lambda, DynamoDB and CloudFormation. Can deploy seperately to segregated dev and prod environments.

## Setup

Install
```
npm install
```

Deploy to dev environemnt
```
npm run deploy:dev
```

Deploy to prod environment
```
npm run deploy:prod
```

Uninstallation
```
serverless remove
```
