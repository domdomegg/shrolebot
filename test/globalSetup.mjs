// Starts DynamoDB Local and creates the games table before the test run.
// Replaces @shelf/jest-dynamodb: the table definition comes straight from
// serverless.yml, with TableName pinned because tests read a fixed
// process.env.TABLE_NAME (see test/environmentVariables.js).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dynamodbLocal from 'aws-dynamodb-local'
import yaml from 'js-yaml'
import awsSdk from 'aws-sdk'

const PORT = 8000
const dirname = path.dirname(fileURLToPath(import.meta.url))

export const setup = async () => {
  await dynamodbLocal.install({ installPath: path.join(dirname, '..', '.dynamodb') })
  await dynamodbLocal.start({
    port: PORT,
    installPath: path.join(dirname, '..', '.dynamodb'),
    sharedDb: true // one database for all test workers, like jest-dynamodb had
  })

  const config = yaml.load(fs.readFileSync(path.join(dirname, '..', 'serverless.yml'), 'utf8'))
  const tables = Object.values(config.resources.Resources)
    .filter((resource) => resource.Type === 'AWS::DynamoDB::Table')
    .map(({ Properties: { TimeToLiveSpecification, ...createTableInput } }) => ({
      // TimeToLiveSpecification is CloudFormation-only, not valid CreateTable input
      ...createTableInput,
      TableName: 'secret-hitler-role-bot-dev-games'
    }))

  const dynamodb = new awsSdk.DynamoDB({
    endpoint: `http://localhost:${PORT}`,
    region: 'local-env',
    credentials: { accessKeyId: 'fakeMyKeyId', secretAccessKey: 'fakeSecretAccessKey' }
  })
  await Promise.all(tables.map((t) => dynamodb.createTable(t).promise()))
}

export const teardown = async () => {
  await dynamodbLocal.stop(PORT)
}
