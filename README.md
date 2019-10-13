# Secret Hitler Role Bot

[![CI/CD Status](https://github.com/domdomegg/shrolebot/workflows/CI/CD/badge.svg)](https://github.com/domdomegg/shrolebot/actions?workflow=CI/CD)
[![JavaScript Standard Style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/domdomegg/shrolebot/blob/master/LICENSE)

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