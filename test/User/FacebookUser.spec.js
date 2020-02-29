jest.mock('request-promise-native')
const request = require('request-promise-native')

const userGenerator = require('../../src/common/userGenerator')

afterEach(() => {
  request.mockReset()
})

it('Uses local first name if provided in constructor', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'FACEBOOK', networkScopedId: '12345678abcd', firstName: 'Adam' })

  // WHEN
  const returnedFirstName = await user.getFirstNamePromise()

  // THEN
  expect(request).not.toHaveBeenCalled()
  expect(returnedFirstName).toBe('Adam')
})

it('Gets first name from Facebook API', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'FACEBOOK', networkScopedId: '12345678abcd', firstName: null })
  request.mockResolvedValue({ first_name: 'Adam' })
  process.env.FB_PAGE_ACCESS_TOKEN = 'ABCD123'
  expect(request).not.toHaveBeenCalled()

  // WHEN
  const returnedFirstName = await user.getFirstNamePromise()

  // THEN
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith(expect.objectContaining({
    method: 'GET',
    uri: 'https://graph.facebook.com/12345678abcd?fields=first_name&access_token=ABCD123'
  }))
  expect(returnedFirstName).toBe('Adam')
})

it('Caches name locally after first call to Facebook API', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'FACEBOOK', networkScopedId: '12345678abcd', firstName: null })
  request.mockResolvedValue({ first_name: 'Adam' })
  process.env.FB_PAGE_ACCESS_TOKEN = 'ABCD123'
  expect(request).not.toHaveBeenCalled()

  // WHEN
  const returnedFirstName1 = await user.getFirstNamePromise()

  // THEN
  expect(request).toHaveBeenCalledTimes(1)
  expect(returnedFirstName1).toBe('Adam')

  // WHEN
  const returnedFirstName2 = await user.getFirstNamePromise()

  // THEN
  expect(request).toHaveBeenCalledTimes(1)
  expect(returnedFirstName2).toBe('Adam')
})

it('Sends plain text messages to the Facebook API', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'FACEBOOK', networkScopedId: '12345678abcd', firstName: null })
  request.mockResolvedValue()
  process.env.FB_PAGE_ACCESS_TOKEN = 'ABCD123'
  expect(request).not.toHaveBeenCalled()

  // WHEN
  await user.sendMessage('yeet')

  // THEN
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: 'ABCD123' },
    method: 'POST',
    json: {
      recipient: { id: '12345678abcd' },
      message: { text: 'yeet' }
    }
  })
})

it('Sends text messages with suggestions to the Facebook API', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'FACEBOOK', networkScopedId: '12345678abcd', firstName: null })
  request.mockResolvedValue()
  process.env.FB_PAGE_ACCESS_TOKEN = 'ABCD123'
  expect(request).not.toHaveBeenCalled()

  // WHEN
  await user.sendMessage('Can I offer you an egg in this trying time?', ['Nah', 'Hell yeah!'])

  // THEN
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: 'ABCD123' },
    method: 'POST',
    json: {
      recipient: { id: '12345678abcd' },
      message: {
        text: 'Can I offer you an egg in this trying time?',
        quick_replies: [
          { content_type: 'text', title: 'Nah', payload: 'Nah' },
          { content_type: 'text', title: 'Hell yeah!', payload: 'Hell yeah!' }
        ]
      }
    }
  })
})
