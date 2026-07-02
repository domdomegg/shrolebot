'use strict'

const userGenerator = require('../common/userGenerator.js')
const LogicHandler = require('../common/logic.js')

exports.handler = async (event) => {
  // GET request is Facebook performing verification
  if (event.httpMethod === 'GET') {
    const queryParams = event.queryStringParameters
    if (!queryParams || !queryParams['hub.verify_token']) {
      return { body: 'Missing validation token', statusCode: 400 }
    }

    if (!queryParams['hub.challenge']) {
      return { body: 'Missing challenge', statusCode: 400 }
    }

    if (queryParams['hub.verify_token'] !== process.env.VERIFY_TOKEN) {
      return { body: 'Wrong validation token', statusCode: 401 }
    }

    return { body: queryParams['hub.challenge'], statusCode: 200 }
  }

  // POST request represents new messages
  if (event.httpMethod === 'POST') {
    const data = JSON.parse(event.body)

    // Make sure this is a page subscription
    if (data.object !== 'page') {
      return { body: 'UNSUPPORTED_OPERATION', statusCode: 415 }
    }

    // Iterate over each entry - there may be multiple if batched.
    // e.messaging always only has one event, so take index 0.
    // Anything other than a message event (e.g. messaging_postbacks) is ignored.
    await Promise.all(data.entry
      .map((e) => e.messaging[0])
      .filter((messagingEvent) => messagingEvent.message)
      .map((messagingEvent) => handleMessage(messagingEvent.sender.id, messagingEvent.message)))

    // Let Facebook know we got the message
    return { body: 'EVENT_RECEIVED', statusCode: 200 }
  }

  return { body: 'UNSUPPORTED_OPERATION', statusCode: 415 }
}

// Handles messages events
function handleMessage (facebookPsid, receivedMessage) {
  const user = userGenerator({
    networkName: 'FACEBOOK',
    networkScopedId: facebookPsid,
    firstName: null
  })

  if (!receivedMessage.text) {
    return LogicHandler.handleNoMessage(user)
  }

  const msg = receivedMessage.text
  console.log("Recieved message '" + msg + "' from user with PSID " + facebookPsid)
  return LogicHandler.handleMessage(user, msg)
}
