'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var fetch = require('isomorphic-fetch');
var WebSocket = require('ws');
var learning = require('./learning').default;

const TICK = 4; //seconds

const COLORS = require('./constants').colors;

function findColorName(redComponent) {
  return _.findKey(COLORS, c => c.r == 50 * Math.round(redComponent / 50));
};

const API_BASE_WS_URL = 'wss://api.artik.cloud/v1.1/';

let ws;

let persons = {};
let personBuffer;

let initialState = {
  CurrentLightState: {
    on: true,
    brightness: 0.8,
    colorRGB: COLORS.red,
  },
  CurrentPresenceCount: 0,
};

let devices = {
  Camera:  {
    id: 'e42343a96f5344e2827691ac1d2c611d',
  },
  Light: {
    id: process.env.HUE_LIGHT_ID,
  },
  craftDevice: {
    id: process.env.ARTIK_CRAFT_ID,
    token: process.env.ARTIK_CRAFT_TOKEN,
    state: {},
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
};

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
    return Promise.all(
      _.map(devices, (device, name) => {
        if (!_.isUndefined(device.token)) {
          let message = {
            Authorization: 'bearer ' + device.token,
            sdid: device.id,
            type: 'register',
          };
          console.log('Registering Artik device', name);
          return Promise.resolve(ws.send(JSON.stringify(message)));
        }
      })
    )
    // create craft ai agent
    .then(() => learning.createAgents())
    // apply arbitrary initial state
    .then(() => learning.setInitialState({
      color: findColorName(initialState.CurrentLightState.colorRGB.r),
      presence: initialState.CurrentPresenceCount,
    }))
    .then(() => learning.takeLightColorDecision())
    .then(decision => {
      devices.craftDevice.state = initialState;
      let PredictedLightState = _.cloneDeep(devices.craftDevice.state.CurrentLightState);
      if (!_.isUndefined(decision)) {
        PredictedLightState.colorRGB = COLORS[decision];
      }

      devices.craftDevice.state.PredictedLightState = PredictedLightState;
    })
    .then(() => sendMessageToDevice(devices.craftDevice.id, {
        PredictedLightState: devices.craftDevice.state.PredictedLightState,
        CurrentLightState: devices.craftDevice.state.CurrentLightState,
        CurrentPresenceCount: devices.craftDevice.state.CurrentPresenceCount,
      })
    )
    .catch(console.log);
  };

  function onMessageReceived(evt) {
    let evtJSON = JSON.parse(evt);
    if (!_.isUndefined(evtJSON) && _.has(evtJSON, 'data.actions')) {
      _.reduce(evtJSON.data.actions, (p, v) => {
        switch (v.name) {
          case 'updateLightState': // light has changed color
            console.log('action received: updateLightState with red level =', v.parameters.colorRed);
            let colorName = findColorName(v.parameters.colorRed);
            devices.craftDevice.state.CurrentLightState = {
              brightness: v.parameters.brightness,
              on: v.parameters.on,
              colorRGB: COLORS[colorName],
            };
            devices.craftDevice.state.PredictedLightState = _.cloneDeep(devices.craftDevice.state.CurrentLightState);
            console.log('new current state =', devices.craftDevice.state.CurrentLightState);
            return p
            // update craft with new light state
            // do not take decision, since it might be manually triggered
            .then(() => learning.updateLightState(colorName));
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
              if (_.size(persons) !== devices.craftDevice.state.CurrentPresenceCount) {
                // update the number of detected persons
                devices.craftDevice.state.CurrentPresenceCount = _.size(persons);
                learning.updatePresenceState(devices.craftDevice.state.CurrentPresenceCount)
                .then(() => learning.takeLightColorDecision())
                .then(decision => {
                  console.log('decision:', decision);
                  if (!_.isUndefined(decision)) {
                    devices.craftDevice.state.PredictedLightState.colorRGB = COLORS[decision];
                  }
                })
                .then(() => sendMessageToDevice(evtJSON.ddid, devices.craftDevice.state))
                .catch(console.log);
              }
            }, 1000 * TICK);
            devices.craftDevice.state.CurrentPresenceCount = _.size(persons);
            return p
            // 1 - update craft with new data
            .then(() => learning.updatePresenceState(devices.craftDevice.state.CurrentPresenceCount))
            // 2 - retrieve decision
            .then(() => learning.takeLightColorDecision())
            .then(decision => {
              console.log('decision:', decision);
              if (!_.isUndefined(decision)) {
                devices.craftDevice.state.PredictedLightState.colorRGB = COLORS[decision];
              }
            });
          default:
            return Promise.reject(new Error(v.name + ' is an unknwon action'));
        }
      }, Promise.resolve())
      .then(() => sendMessageToDevice(evtJSON.ddid, devices.craftDevice.state))
      .catch(console.log);
    }
  };
};

exports.default = start;