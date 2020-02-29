const userGenerator = require('../../src/common/userGenerator')

it('Uses local first name if provided in constructor', async () => {
  // GIVEN
  const user = userGenerator({ networkName: 'TELEGRAM', networkScopedId: '12345678abcd', firstName: 'Adam' })

  // WHEN
  const returnedFirstName = await user.getFirstNamePromise()

  // THEN
  expect(returnedFirstName).toBe('Adam')
})
