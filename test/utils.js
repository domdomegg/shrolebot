const MockUser = require('../src/User/MockUser')

module.exports = {
  // Use line number to generate a gameID that is guaranteed not to clash within a test.
  // Takes the first stack frame outside this file; vitest frames don't always
  // wrap the location in parentheses like jest's did, so match bare file:line:col too.
  getLineNumber: () => {
    const caller = new Error().stack.split('\n').find((l) => /:\d+:\d+\)?$/.test(l) && !l.includes('utils.js'))
    return parseInt(/:(\d+):\d+\)?$/.exec(caller)[1])
  },

  createMockUser: (firstName, networkScopedId = Math.floor(Math.random() * (99999 - 10000)) + 10000) => {
    const user = new MockUser(
      'MOCK',
      networkScopedId,
      firstName
    )
    user.sendMessage = vi.fn().mockResolvedValue()
    return user
  },

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
      credentials: {
        accessKeyId: 'fakeMyKeyId',
        secretAccessKey: 'fakeSecretAccessKey'
      },
      params: {
        TableName: process.env.TABLE_NAME
      }
    })
  }
}
