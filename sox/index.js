
const WebSocket = require('ws')
const sox = require('./core')
const connect = sox(WebSocket)

function connectAs(host, name, token, cb) {
  console.log(`connecting to ${host}...`)
  return connect(host, sox => {
    console.log(`identifying as {name}...`)
    sox.identify(name, token, cb)
  })
}

module.exports = {
  connect,
  connectAs,
}

