'use strict'

const userGenerator = require('../common/userGenerator.js')
const LogicHandler = require('../common/logic.js')

exports.handler = async (event) => {
  // POST request represents new messages
  if (event.httpMethod !== 'POST' || !event.body) {
    return { body: 'UNSUPPORTED_OPERATION', statusCode: 415 }
  }

  // Updates without a plain message (e.g. edited_message, channel_post) are
  // acknowledged and ignored — anything but a 200 makes Telegram retry the update
  const data = JSON.parse(event.body).message
  if (!data || !data.chat || !data.from) {
    return { body: 'EVENT_RECEIVED', statusCode: 200 }
  }

  const user = userGenerator({
    networkName: 'TELEGRAM',
    networkScopedId: data.chat.id,
    firstName: data.from.first_name
  })

  if (data.chat.type !== 'private') {
    await user.sendMessage('This bot only works in private chats')
    return { body: 'EVENT_RECEIVED', statusCode: 200 }
  }

  if (!data.text) {
    await LogicHandler.handleNoMessage(user)
  } else {
    console.log("Recieved message '" + data.text + "' from chat with id " + data.chat.id)
    await LogicHandler.handleMessage(user, data.text)
  }

  return { body: 'EVENT_RECEIVED', statusCode: 200 }
}
