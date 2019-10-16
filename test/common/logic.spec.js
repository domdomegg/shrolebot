const utils = require('../utils')

const logic = require('../../src/common/logic')

const gameStore = utils.getGameStore()

const mock = {}

beforeAll(() => {
  mock.console = {
    warn: jest.spyOn(console, 'warn').mockImplementation()
  }
  mock.user = utils.createMockUser('somebody')
})

afterEach(() => {
  mock.console.warn.mockReset()
  mock.user.sendMessage.mockReset()
})

it('can handle no message', () => {
  // WHEN
  logic.handleNoMessage(mock.user)

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Something went wrong getting the message to me. Please tell Adam if you see this error.')
})

it('disallows the database command in prod', async () => {
  // GIVEN
  process.env.STAGE = 'prod'

  // WHEN
  await logic.handleMessage(mock.user, 'database 1234')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Cannot get database entry while in stage prod')
  expect(mock.console.warn).toBeCalledWith(`${mock.user} tried command 'database 1234' in stage 'prod'`)
})

it('can handle the database command in dev', async () => {
  // GIVEN
  process.env.STAGE = 'dev'
  const gameID = await gameStore.createGameWithOwner(utils.createMockUser('somebody', 1234567))

  // WHEN
  await logic.handleMessage(mock.user, 'database ' + gameID)

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  const msg = mock.user.sendMessage.mock.calls[0]
  const parsedMsg = JSON.parse(msg)
  expect(Object.keys(parsedMsg)).toEqual(['gameID', 'ttl', 'players', 'owner'])
  expect(parsedMsg.gameID).toBe(gameID)
  expect(typeof parsedMsg.ttl).toBe('number')
  expect(parsedMsg.players).toEqual([{ firstName: 'somebody', networkName: 'MOCK', networkScopedId: 1234567 }])
  expect(parsedMsg.owner).toEqual({ firstName: 'somebody', networkName: 'MOCK', networkScopedId: 1234567 })
})

it('can handle the database command with an invalid gameID', async () => {
  // GIVEN
  process.env.STAGE = 'dev'

  // WHEN
  await logic.handleMessage(mock.user, 'database 4713')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Game 4713 not found - check the number is correct')
})
