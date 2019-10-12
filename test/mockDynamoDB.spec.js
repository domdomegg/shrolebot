const { DocumentClient } = require('aws-sdk/clients/dynamodb')

const config = {
  convertEmptyValues: true,
  ...(process.env.JEST_WORKER_ID && { endpoint: 'localhost:8000', sslEnabled: false, region: 'local-env' }),
  TableName: 'secret-hitler-role-bot-dev-games'
}

const ddb = new DocumentClient(config)

it('should insert into and retrieve from table', async () => {
  await ddb.put({
    Item: {
      gameID: 1234,
      gameOwner: 'somebody',
      players: ddb.createSet(['somebody', 'someone else']),
      ttl: 1602451810
    },
    ConditionExpression: 'attribute_not_exists(gameID)',
    TableName: 'secret-hitler-role-bot-dev-games'
  }).promise()

  const { Item } = await ddb.get({
    TableName: 'secret-hitler-role-bot-dev-games',
    Key: {
      gameID: 1234
    }
  }).promise()

  expect(Item.gameID).toBe(1234)
  expect(Item.gameOwner).toBe('somebody')
  expect(Item.players.values).toEqual(['somebody', 'someone else'])
  expect(Item.ttl).toBe(1602451810)
})
