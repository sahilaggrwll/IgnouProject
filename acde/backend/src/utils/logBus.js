const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100);

function emitLog(deploymentId, message) {
  bus.emit(`log:${deploymentId}`, {
    deployment_id: deploymentId,
    log_message: message,
    timestamp: new Date(),
  });
}

function onLog(deploymentId, listener) {
  const event = `log:${deploymentId}`;
  bus.on(event, listener);
  return () => bus.off(event, listener);
}

module.exports = { emitLog, onLog, bus };
