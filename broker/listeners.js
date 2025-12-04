import { map } from 'lodash-es'

// CONSTANTS
const EVENT_NAMES = [
  'client',
  'clientReady',
  'clientDisconnect',
  'clientError',
  'connectionError',
  'keepaliveTimeout',
  'publish',
  'ack',
  'ping',
  'subscribe',
  'unsubscribe',
  'connackSent',
  'closed'
]

// HELPERS
const
  formatPacket = packet => (packet ? { topic: packet.topic, payload: packet.payload?.toString() } : 'packet unavailable'),
  addListeners = (broker, listeners, options={}) => {
    const handledEvents = Object.keys(listeners)

    handledEvents.forEach(eventName => {
      const eventHandler = listeners[eventName]
      if(options.curryBroker) {
        const boundHandler = eventHandler.bind(eventHandler, broker)
        broker.on(eventName, boundHandler)
      } else {
        broker.on(eventName, eventHandler)
      }
    })
  }

// LATENCY TRACKING
const
  LATENCY_TIMEOUT_MS = 30 * 1000,
  isWebClient = clientId => typeof clientId === 'string' && clientId.startsWith('web-'),
  shouldIgnoreTopic = topic => topic?.startsWith('metrics/') || topic?.startsWith('state/'),
  latencyTracker = (() => {
    let pendingProbe = null

    return {
      start(sendTopic, clientId) {
        console.log(`[latency] start publish sendTopic=${sendTopic} client=${clientId}`)
        pendingProbe = {
          sendTopic,
          clientId,
          startedAt: Date.now(),
        }
      },
      clearIfStale(now) {
        if(pendingProbe && now - pendingProbe.startedAt > LATENCY_TIMEOUT_MS) {
          console.log(`[latency] stale measurement cleared for sendTopic=${pendingProbe.sendTopic}`)
          pendingProbe = null
        }
      },
      maybeRecord(broker, packet, client) {
        if(!pendingProbe) { return }

        const now = Date.now()
        this.clearIfStale(now)
        if(!pendingProbe) { return }

        // ignore publishes from the same web client that initiated the send
        if(client?.id && client.id === pendingProbe.clientId) { return }

        const latencyMs = now - pendingProbe.startedAt
        const responderClientId = client?.id || 'internal'
        const metric = {
          latencyMs,
          startedAt: pendingProbe.startedAt,
          completedAt: now,
          sendTopic: pendingProbe.sendTopic,
          sendClientId: pendingProbe.clientId,
          responseTopic: packet.topic,
          responseClientId: responderClientId,
        }

        console.log(`[latency] send->payload ${latencyMs}ms | sendTopic=${pendingProbe.sendTopic} | responseTopic=${packet.topic} | responder=${responderClientId}`)

        pendingProbe = null
      }
    }
  })()

// GROUPS OF HANDLERS
const
  LOGGING = {
    client: client => console.log(`connected (${client.id})`),
    clientReady: client => console.log(`ready (${client.id})`),
    clientDisconnect: client => console.log(`disconnected (${client.id})`),
    clientError: (client, error) => console.log(`error (${client.id}):`, error),
    connectionError: (client, error) => console.log(`connection error (${client.id}):`, error),
    keepaliveTimeout: (client) => console.log(`keepalive timeout (${client.id})`),
    publish: (packet, client) => console.log(`publish (${client?.id || 'internal'}):`, formatPacket(packet)),
    ack: (packet, client) => console.log(`ack (${client.id}):`, formatPacket(packet)),
    ping: (packet, client) => console.log(`ping (${client.id}):`, formatPacket(packet)),
    subscribe: (subscriptions, client) => console.log(`subscriptions (${client.id})`, subscriptions),
    unsubscribe: (unsubscriptions, client) => console.log(`unsubscriptions (${client.id}):`, unsubscriptions),
    connackSent: (packet, client) => console.log(`connack (${client.id}):`, packet),
    closed: () => console.log("Broker closed."),
  },

  // publish state update whenever clients or subscriptions change
  emitState = (broker) => {
    // get all clients from broker
    console.log("EMITTING")
    // transform clients to data
    const clients = map(broker.clients, ({ id, subscriptions }) => {
      return { id, subscriptions: Object.keys(subscriptions) }
    })
    // publish client data on magic topic
    broker.publish({ topic: "state/clients", payload: JSON.stringify(clients) })
  },
  REACTIVE_EMITTERS = {
    client: emitState,
    clientDisconnect: emitState,
    subscribe: emitState,
    unsubscribe: emitState,
  },
  LATENCY_INSTRUMENTATION = {
    publish: (broker, packet, client) => {
      // ignore instrumentation chatter
      if(shouldIgnoreTopic(packet.topic)) { return }

      const clientId = client?.id
      const isSendClick = isWebClient(clientId)

      // record latency on first publish after a send click (any responder, including internal)
      latencyTracker.maybeRecord(broker, packet, client)

      // start tracking for any publish initiated by the web client
      if(isSendClick) {
        latencyTracker.start(packet.topic, clientId)
      }
    }
  }

export const
  addLoggingListeners = broker => {
    console.log(`Adding Logging Listeners to Broker '${broker.id}'`)
    addListeners(broker, LOGGING)
  },

  addReactiveEmitters = broker => {
    console.log(`Adding Reactive State-Change Emitter Listeners to Broker '${broker.id}'`)
    addListeners(broker, REACTIVE_EMITTERS, { curryBroker: true })
  },

  addLatencyInstrumentation = broker => {
    console.log(`Adding Latency Instrumentation Listeners to Broker '${broker.id}'`)
    addListeners(broker, LATENCY_INSTRUMENTATION, { curryBroker: true })
  }
