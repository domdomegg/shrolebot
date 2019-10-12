const logic = require('../../src/common/logic')

const mock = {}

beforeAll(() => {
  mock.console = {
    warn: jest.spyOn(console, 'warn').mockImplementation()
  }
  mock.user = {
    sendMessage: jest.fn()
  }
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

it('disallows the database command in prod', () => {
  // GIVEN
  process.env.STAGE = 'prod'

  // WHEN
  logic.handleMessage(mock.user, 'database')

  // THEN
  expect(mock.user.sendMessage).toHaveBeenCalledTimes(1)
  expect(mock.user.sendMessage).toBeCalledWith('Cannot get database entry while in stage prod')
  expect(mock.console.warn).toBeCalledWith(`${mock.user} tried command 'database' in stage 'prod'`)
})
