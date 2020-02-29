# 🙌 Contributing

See the setup scripts in the [readme](README.md) to get set up. 🔧

## ☁️ Releases

### 🚧 CI/CD (dev only)

Every commit to master will kick off a CI build. If the tests are successful a CD build will deploy the new version to the dev environment. Build logs are available publicly on GitHub.

### 👷 Manual (dev and prod)

1. Ensure your local copy is what you want deployed (for prod, this should be a version that's been tested in dev)
2. Run `npm ci --production` to install just the non-development dependencies
3. Run `npm run deploy:dev` or `npm run deploy:prod` to deploy the app to the respective environment

## 📈 Monitoring

There are several places to monitor and debug issues:
- GitHub build logs: test or deployment statuses and logs
- AWS CloudFormation: infrastructure changes, and a high level overview of app health
- AWS CloudWatch Metrics and Logs: app health indicators (e.g. HTTP status codes)
- AWS CloudWatch Logs: all log output from the Lambda functions
- AWS DynamoDB: insight into the database state
- The commands 'version' and 'database &lt;game id&gt;' (dev only): the deployed version and database state