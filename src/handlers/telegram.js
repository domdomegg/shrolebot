'use strict'

const userGenerator = require('../common/userGenerator.js')
const LogicHandler = require('../common/logic.js')

exports.handler = (event, context, callback) => {
  // POST request represents new messages
  if (event.httpMethod === 'POST' && event.body) {
    const data = JSON.parse(event.body).message

    const user = userGenerator({
      networkName: 'TELEGRAM',
      networkScopedId: data.chat.id,
      firstName: data.from.first_name
    })

    if (data.chat.type !== 'private') {
      user.sendMessage('This bot only works in private chats')
      return
    };

    if (!data.text) {
      LogicHandler.handleNoMessage(user)
    } else {
      const msg = data.text
      console.log("Recieved message '" + msg + "' from chat with id " + data.chat.id)
      LogicHandler.handleMessage(user, msg)
    }

    callback(null, {
      body: 'EVENT_RECEIVED',
      statusCode: 200
    })
  }
}
