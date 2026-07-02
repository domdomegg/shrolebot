const utils = require('../utils')

const logic = require('../../src/common/logic')

const gameStore = utils.getGameStore()

const mock = {}

beforeAll(() => {
  mock.console = {
    warn: vi.spyOn(console, 'warn').mockImplementation()
  }
  mock.user = utils.createMockUser('somebody')
})

afterEach(() => {
  mock.console.warn.mockReset()
  mock.user.sendMessage.mockReset()
})

it('handles no message', () => {
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

it('handles the database command in dev', async () => {
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

it('handles the database command in dev with an invalid gameID', async () => {
  // GIVEN
  process.env.STAGE = 'dev'

  // WHEN
  await logic.handleMessage(mock.user, 'database 4713')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Game 4713 not found 😕 - check the game id is correct')
})

it('handles the version command when known', async () => {
  // GIVEN
  process.env.VERSION = '20191017.000000.abcd123'

  // WHEN
  await logic.handleMessage(mock.user, 'version')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Version 20191017.000000.abcd123')
})

it('handles the version command when UNKNOWN', async () => {
  // GIVEN
  process.env.VERSION = 'UNKNOWN'

  // WHEN
  await logic.handleMessage(mock.user, 'version')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Version UNKNOWN')
})

it('handles invalid join command', async () => {
  // WHEN
  await logic.handleMessage(mock.user, 'join invalid')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Game "invalid" not found 😕 - check the game id is correct (it should be a 4 digit number like "1234")')
})

it('does not resolve until sends have completed (no fire-and-forget)', async () => {
  // GIVEN a send whose completion we control
  let resolveSend
  mock.user.sendMessage.mockImplementation(() => new Promise((resolve) => { resolveSend = resolve }))

  // WHEN
  let settled = false
  const promise = logic.handleMessage(mock.user, 'help').then(() => { settled = true })

  // THEN the handler must still be pending while the send is in flight.
  // If it resolves early, the Lambda runtime would freeze the container
  // with the reply un-sent (it only thaws on some later invocation).
  await new Promise((resolve) => setTimeout(resolve, 25))
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(settled).toBe(false)

  // ...and it resolves once the send completes
  resolveSend()
  await promise
  expect(settled).toBe(true)
})
