const AbstractUser = require('./AbstractUser')

class MockUser extends AbstractUser {
  // In tests, test/utils.js replaces sendMessage with a vi.fn() spy
  sendMessage () {
    return Promise.resolve()
  }

  getFirstNamePromise () {
    return Promise.resolve(this.firstName)
  }
}

module.exports = MockUser
