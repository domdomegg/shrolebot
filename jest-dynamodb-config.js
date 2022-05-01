const Serverless = require('serverless')
const path = require('path')
const fs = require('fs')
const yaml = require('js-yaml')

module.exports = async () => {
  const serviceDir = process.cwd()
  const configurationFilename = 'serverless.yml'
  const configuration = yaml.load(fs.readFileSync(path.resolve(serviceDir, configurationFilename), 'utf8'))
  const serverless = new Serverless({ configuration, serviceDir, configurationFilename, commands: [], options: {} })

  await serverless.init()
  const resources = serverless.service.resources.Resources

  const tables = Object.keys(resources)
    .map(name => resources[name])
    .filter(resource => resource.Type === 'AWS::DynamoDB::Table')
    .map(resource => resource.Properties)
    // https://github.com/shelfio/jest-dynamodb/issues/62
    .map((definition) => ({
      ...definition,
      TableName: 'secret-hitler-role-bot-dev-games'
    }))

  return {
    tables,
    port: 8000
  }
}
