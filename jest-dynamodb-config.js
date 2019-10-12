module.exports = async () => {
  const serverless = new (require('serverless'))()

  await serverless.init()
  const service = await serverless.variables.populateService()
  const resources = service.resources.Resources

  const tables = Object.keys(resources)
    .map(name => resources[name])
    .filter(resource => resource.Type === 'AWS::DynamoDB::Table')
    .map(resource => resource.Properties)
    // https://github.com/shelfio/jest-dynamodb/issues/62
    .map(({ AttributeDefinitions, KeySchema, GlobalSecondaryIndexes, BillingMode, TableName }) => ({
      AttributeDefinitions,
      KeySchema,
      GlobalSecondaryIndexes,
      BillingMode,
      TableName
    }))

  return {
    tables,
    port: 8000
  }
}
