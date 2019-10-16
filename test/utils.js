const MockUser = require('../src/User/MockUser')

module.exports = {
  // Use line number to generate a gameID that is guaranteed not to clash within a test
  getLineNumber: () => parseInt(/\((.*):(\d+):(\d+)\)$/.exec(new Error().stack.split('\n')[2])[2]),

  createMockUser: (firstName, networkScopedId = Math.floor(Math.random() * (99999 - 10000)) + 10000) => new MockUser(
    'MOCK',
    networkScopedId,
    firstName
  ),

  getGameStore: () => {
    const DynamoDBGameStore = require('../src/GameStore/DynamoDBGameStore')
    return new DynamoDBGameStore()
  },

  getDocumentClient: () => {
    const { DocumentClient } = require('aws-sdk/clients/dynamodb')
    return new DocumentClient({
      endpoint: 'localhost:8000',
      sslEnabled: false,
      region: 'local-env',
      params: {
        TableName: process.env.TABLE_NAME
      }
    })
  }
}
