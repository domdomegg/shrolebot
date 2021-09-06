'use strict'

const axios = require('axios').default
const AbstractUser = require('./AbstractUser')

class FacebookUser extends AbstractUser {
  async getFirstNamePromise () {
    if (this.firstName == null) {
      const res = await axios({
        method: 'GET',
        url: `https://graph.facebook.com/${this.networkScopedId}?fields=first_name&access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`
      })
      this.firstName = res.data.first_name
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
    return axios({
      method: 'POST',
      url: 'https://graph.facebook.com/v2.6/me/messages',
      params: { access_token: process.env.FB_PAGE_ACCESS_TOKEN },
      data: requestBody
    })
      .then(() => { console.log('Message sent' + (msg ? ': ' + msg : '')) })
      .catch(err => {
        if (err && err.isAxiosError) {
          console.error('Unable to send message: ' + msg + ' as got error ' + err, err.response && err.response.data)
        }
        console.error('Unable to send message: ' + msg + ' as got error ' + err)
      })
  }
}

module.exports = FacebookUser
