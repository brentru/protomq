import Aedes from 'aedes'

// MQTT Setup
import net from 'net'

const broker = Aedes()

const mqttPort = Number(process.env.MQTT_PORT) || 1884
const wsPort = Number(process.env.WS_PORT) || 8888

// Retry listen on the next port if the preferred port is already bound.
function listenWithRetry(server, port, label) {
  let currentPort = port

  const attemptListen = () => {
    server.listen(currentPort, function () {
      console.log(`${label} listening on port`, currentPort)
    })
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = currentPort + 1
      console.warn(`${label} port ${currentPort} in use; retrying on ${nextPort}`)
      currentPort = nextPort
      setTimeout(attemptListen, 50)
      return
    }

    console.error(`${label} failed to start`, err)
    process.exit(1)
  })

  attemptListen()
}

const server = net.createServer(broker.handle)
listenWithRetry(server, mqttPort, 'MQTT')

// MQTT-over-Websockets Setup
import http from 'http'
import ws from 'websocket-stream'

const httpServer = http.createServer()
ws.createServer({ server: httpServer }, broker.handle)

listenWithRetry(httpServer, wsPort, 'MQTT over WebSocket')

// App Code
import { addLatencyInstrumentation, addLoggingListeners, addReactiveEmitters } from "./broker/listeners.js"

addLoggingListeners(broker)
addReactiveEmitters(broker)
addLatencyInstrumentation(broker)
