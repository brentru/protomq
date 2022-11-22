import { forEach, flatten, map, sortBy, uniq } from "lodash-es"

import PB from '../protobufs'

const TOPIC_PARSERS = {
  "*/wprsnpr/info/status": PB.CreateDescriptionRequest,
  "*/info/status/device/complete": PB.RegistrationComplete,
  "*/signals/device": PB.CreateSignalRequest,
  "*/signals/device/i2c": PB.I2CResponse,
  "*/signals/device/pinConfigComplete": PB.SignalResponse,
  "*/signals/device/servo": PB.ServoResponse,
  "*/signals/device/ds18x20": PB.Ds18x20Response,
  "*/signals/device/pwm": PB.PWMResponse,
}

const parseMessageByTopic = (topic, message) => {
  let parser

  forEach(TOPIC_PARSERS, (currentParser, topicSpec) => {
    if(parser) { return }

    if(topicSpec.startsWith('*')) {
      const topicEndFragment = topicSpec.slice(1)
      if(topic.endsWith(topicEndFragment)) {
        parser = currentParser
      }

    } else {
      if(topic === topicSpec) {
        parser = currentParser
      }
    }
  })

  if(!parser) {
    try{
      return JSON.parse(message)
    } catch(err) { return message }
  }

  return (parser.deserializeBinary
    ? parser.deserializeBinary(message).toObject()
    : parser(message))
}

// from react
const options = {
  clientId: `web-${Math.round(Math.random()*10000000000)}`,
  connectTimeout: 60 * 1000,
  keepalive: 60,
  resubscribe: false,
  reconnectPeriod: 6000, // wait between connection attempts
}

const config = {
  "mqttPort": "8888",
  "mqttHost": "localhost",
  "mqttProtocol": "ws",
}

const mqttUrl = `${config.mqttProtocol}://${config.mqttHost}:${config.mqttPort}`
const client = mqtt.connect(mqttUrl, options)

client.on('connect', () => {
  client.subscribe(["#", "$SYS/#"], err => {
    if(err) { console.error(err) }
  })
})

const
  messages = [],
  clients = [],
  subscriptions = []

client.on('message', (topic, message) => {
  const parsedMessage = parseMessageByTopic(topic, message)
  messages.unshift({ topic, message, parsedMessage })
  refreshMessages()

  // if it's a broker introspection topic, update the data stores
  if(topic === "state/clients") {
    const clientsCollection = JSON.parse(message)

    clients.splice(0, Infinity, ...map(clientsCollection, "id"))
    console.log("Clients:", clients)
    refreshClients()

    subscriptions.splice(0, Infinity, ...sortBy(uniq(flatten(map(clientsCollection, "subscriptions")))))
    console.log("Subscriptions:", subscriptions)
    refreshSubscriptions()
  }
})

const refreshMessages = () => {
  document.getElementsByClassName('messages')[0].innerHTML = messages.map(message => `
    <div>
      <dl>
        <dt>Topic:</dt> <dd title="${ message.topic }">${ renderTopic(message.topic) }</dd>
        <dt>Payload:</dt> <dd title='${ message.message }'>${ renderMessage(message.parsedMessage) }</dd>
      </dl>
    </div>
  `).join("<hr />")
}

const refreshClients = () => {
  document.getElementsByClassName("clients")[0].innerHTML = clients.map(client => `
    <li>${ client }</li>
  `).join('')
}

const refreshSubscriptions = () => {
  document.getElementsByClassName("subscriptions")[0].innerHTML = subscriptions.map(subscription => `
    <li>${ subscription }</li>
  `).join('')
}

const renderTopic = topic => {
  if(topic.startsWith("$SYS")) {
    const action = topic.split('/').slice(2)
    return `$SYS/.../${action.join('/')}`
  }

  return topic
}

const renderMessage = message => {
  return (message
    ? JSON.stringify(message, null, 2)
    : message)
}
