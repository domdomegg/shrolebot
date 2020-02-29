'use strict'

const request = require('request-promise-native')
const AbstractUser = require('./AbstractUser')

class FacebookUser extends AbstractUser {
  async getFirstNamePromise () {
    if (this.firstName == null) {
      const data = await request({
        uri: `https://graph.facebook.com/${this.networkScopedId}?fields=first_name&access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
        method: 'GET',
        json: true
      })
      this.firstName = data.first_name
    }
    return this.firstName
  }

  // Sends response messages via the Send API
  sendMessage (msg, suggestions = []) {
    const requestBody = {
      recipient: { id: this.networkScopedId },
      message: { text: msg }
    }

    if (suggestions.length) {
      requestBody.message.quick_replies = suggestions
        .map(str => ({ content_type: 'text', title: str, payload: str }))
    }

    // Send the HTTP request to the Messenger Platform
    return request({
      uri: 'https://graph.facebook.com/v2.6/me/messages',
      qs: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: requestBody
    })
      .then(() => { console.log('Message sent' + (msg ? ': ' + msg : '')) })
      .catch(err => { console.error('Unable to send message:' + err) })
  }
}

module.exports = FacebookUser
