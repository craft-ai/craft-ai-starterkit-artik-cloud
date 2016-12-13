'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var WebSocket = require('ws');
var learning = require('./learning');

const TICK = 4; //seconds

const COLORS = require('./data/colors.json');

function findColorName(redComponent) {
  return _.findKey(COLORS, c => c.r == 50 * Math.round(redComponent / 50));
}

const API_BASE_WS_URL = 'wss://api.artik.cloud/v1.1/';

let ws;

let persons = {};
let personBuffer;

let craftLightDevice = {
  id: process.env.ARTIK_CRAFT_DEVICE_ID,
  token: process.env.ARTIK_CRAFT_DEVICE_TOKEN,
  state: {
    CurrentLightRedComponent: COLORS.red.r,
    PredictedLightRedComponent: COLORS.red.r,
    CurrentPresenceCount: 0,
  },
};

function sendMessageToDevice(deviceId, messageContent, type) {
  return new Promise((resolve, reject) => {
    if (!_.isUndefined(ws)) {
      let message = {
        ddid: deviceId,
        sdid: deviceId,
        type: type || 'message',
        data: messageContent,
      };
      console.log('sending message', JSON.stringify(_.pickBy(message, i => !_.isUndefined(i))));
      ws.send(JSON.stringify(_.pickBy(message, i => !_.isUndefined(i))));
      return resolve();
    } else {
      return reject(Error('ARTIK websocket not found'));
    }
  })
  .catch(err => console.log('error while sending message', err));
}

function start(artikToken) {
  ws = new WebSocket(API_BASE_WS_URL + 'websocket?ack=true');

  ws.on('open', () => {
    console.log('ARTIK WS connection open');
    onWsOpen(artikToken);
  });
  ws.on('close', () => {
    console.log('ARTIK WS connection closed');
  });
  ws.on('error', evt => {
    console.log('ARTIK WS connection error:', evt.data);
  });
  ws.on('message', evt => {
    onMessageReceived(evt);
  });

  var onWsOpen = _.once(initWs);
  function initWs(artikToken) {
    let message = {
      Authorization: 'bearer ' + craftLightDevice.token,
      sdid: craftLightDevice.id,
      type: 'register',
    };
    console.log('Registering Artik device');
    return Promise.resolve(ws.send(JSON.stringify(message)))
    // create craft ai agent
    .then(() => learning.createAgents())
    // apply arbitrary initial state
    .then(() => learning.setInitialState({
      color: findColorName(craftLightDevice.state.CurrentLightRedComponent),
      presence: craftLightDevice.state.CurrentPresenceCount,
    }))
    .then(() => sendMessageToDevice(craftLightDevice.id, craftLightDevice.state)
    )
    .catch(console.log);
  }

  function onMessageReceived(evt) {
    let evtJSON = JSON.parse(evt);
    if (!_.isUndefined(evtJSON) && _.has(evtJSON, 'data.actions')) {
      _.reduce(evtJSON.data.actions, (p, v) => {
        switch (v.name) {
          case 'lightColorChanged': // light has changed color
            console.log('action received: updateLightState with red level =', v.parameters.redComponent);
            craftLightDevice.state.CurrentLightRedComponent = v.parameters.redComponent;
            craftLightDevice.state.PredictedLightRedComponent = v.parameters.redComponent;
            return p
            // update craft with new light state
            // do not take decision, since it might be manually triggered
            .then(() => learning.updateLightState(findColorName(v.parameters.redComponent)));
          case 'personDetected': // camera detects a new person
            console.log('action received: updatePresenceState');
            persons[v.parameters.id] = 10 * TICK;
            if (!_.isUndefined(personBuffer)) {
              clearInterval(personBuffer);
            }
            // the buffer allows to store a detected person for 10 * TICK seconds
            personBuffer = setInterval(() => {
              persons = _.reduce(persons, (countdown, timeLeft, person) => {
                if (timeLeft > TICK) {
                  countdown[person] = timeLeft - TICK;
                }
                return countdown;
              }, {});
              if (_.size(persons) !== craftLightDevice.state.CurrentPresenceCount) {
                // update the number of detected persons
                craftLightDevice.state.CurrentPresenceCount = _.size(persons);
                learning.updatePresenceState(craftLightDevice.state.CurrentPresenceCount)
                .then(() => learning.takeLightColorDecision())
                .then(decision => {
                  console.log('decision:', decision);
                  if (!_.isUndefined(decision)) {
                    craftLightDevice.state.PredictedLightRedComponent = COLORS[decision].r;
                  }
                })
                .then(() => sendMessageToDevice(evtJSON.ddid, craftLightDevice.state))
                .catch(console.log);
              }
            }, 1000 * TICK);
            craftLightDevice.state.CurrentPresenceCount = _.size(persons);
            return p
            // 1 - update craft with new data
            .then(() => learning.updatePresenceState(craftLightDevice.state.CurrentPresenceCount))
            // 2 - retrieve decision
            .then(() => learning.takeLightColorDecision())
            .then(decision => {
              console.log('decision:', decision);
              if (!_.isUndefined(decision)) {
                craftLightDevice.state.PredictedLightRedComponent = COLORS[decision].r;
              }
            });
          default:
            return Promise.reject(new Error(v.name + ' is an unknwon action'));
        }
      }, Promise.resolve())
      .then(() => sendMessageToDevice(evtJSON.ddid, craftLightDevice.state))
      .catch(console.log);
    }
  }
}

module.exports = start;
