# Secret Hitler Role Bot

A chatbot that allows users to allocate roles for the board game Secret Hitler, using the AWS serverless platform.

Currently has integrations for Facebook Messenger and Telegram, and uses AWS Lambda, DynamoDB and CloudFormation. Can deploy separately to segregated dev and prod environments.

## Setup

| NPM command     | What it does                 |
|-----------------|------------------------------|
| `install`       | Install dependencies         |
| `lint`          | Find lint issues             |
| `lint:fix`      | Fix most lint issues         |
| `test`          | Run unit tests               |
| `test:watch`    | Run unit tests in watch mode |
| `deploy:dev`    | Deploy to dev environment    |
| `deploy:prod`   | Deploy to prod environment   |
| `teardown:dev`  | Teardown dev environment     |
| `teardown:prod` | Teardown prod environment    |