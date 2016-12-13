'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var WebSocket = require('ws');
var learning = require('./learning');

var TICK = 4; //seconds

var COLORS = require('./data/colors.json');

function findColorName(redComponent) {
  return _.findKey(COLORS, function(c) {
    return c.r == 50 * Math.round(redComponent / 50);
  });
}

var API_BASE_WS_URL = 'wss://api.artik.cloud/v1.1/';

var ws;

var persons = {};
var personBuffer;

var craftLightDevice = {
  id: process.env.ARTIK_CRAFT_DEVICE_ID,
  token: process.env.ARTIK_CRAFT_DEVICE_TOKEN,
  state: {
    CurrentLightRedComponent: COLORS.red.r,
    PredictedLightRedComponent: COLORS.red.r,
    CurrentPresenceCount: 0,
  },
};

function sendMessageToDevice(deviceId, messageContent, type) {
  return new Promise(function(resolve, reject) {
    if (!_.isUndefined(ws)) {
      var message = {
        ddid: deviceId,
        sdid: deviceId,
        type: type || 'message',
        data: messageContent,
      };
      var messageStr = JSON.stringify(_.pickBy(message, function(i) {
        return !_.isUndefined(i);
      }));
      console.log('sending message', messageStr);
      ws.send(messageStr);
      return resolve();
    } else {
      return reject(Error('ARTIK websocket not found'));
    }
  })
  .catch(function(err) {
    console.log('error while sending message', err);
  });
}

function start(artikToken) {
  ws = new WebSocket(API_BASE_WS_URL + 'websocket?ack=true');

  ws.on('open', function() {
    console.log('ARTIK WS connection open');
    onWsOpen(artikToken);
  });
  ws.on('close', function() {
    console.log('ARTIK WS connection closed');
  });
  ws.on('error', function(evt) {
    console.log('ARTIK WS connection error:', evt.data);
  });
  ws.on('message', function(evt) {
    onMessageReceived(evt);
  });

  var onWsOpen = _.once(initWs);
  function initWs(artikToken) {
    var message = {
      Authorization: 'bearer ' + craftLightDevice.token,
      sdid: craftLightDevice.id,
      type: 'register',
    };
    console.log('Registering Artik device');
    return Promise.resolve(ws.send(JSON.stringify(message)))
    // create craft ai agent
    .then(function() {
      return learning.createAgent('LightColor');
    })
    .then(function() {
      return sendMessageToDevice(craftLightDevice.id, craftLightDevice.state);
    })
    .catch(console.log);
  }

  function onMessageReceived(evt) {
    var evtJSON = JSON.parse(evt);
    if (!_.isUndefined(evtJSON) && _.has(evtJSON, 'data.actions')) {
      _.reduce(evtJSON.data.actions, function(p, v) {
        switch (v.name) {
          case 'lightColorChanged': // light has changed color
            console.log('action received: updateLightState with red level =', v.parameters.redComponent);
            craftLightDevice.state.CurrentLightRedComponent = v.parameters.redComponent;
            craftLightDevice.state.PredictedLightRedComponent = v.parameters.redComponent;
            return p
            // update craft with new light state
            // do not take decision, since it might be manually triggered
            .then(function() {
              return learning.updateLightState(findColorName(v.parameters.redComponent));
            });
          case 'personDetected': // camera detects a new person
            console.log('action received: updatePresenceState');
            persons[v.parameters.id] = 10 * TICK;
            if (!_.isUndefined(personBuffer)) {
              clearInterval(personBuffer);
            }
            // the buffer allows to store a detected person for 10 * TICK seconds
            personBuffer = setInterval(function() {
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
                .then(function() {
                  return learning.takeLightColorDecision();
                })
                .then(function(decision) {
                  console.log('decision:', decision);
                  if (!_.isUndefined(decision)) {
                    craftLightDevice.state.PredictedLightRedComponent = COLORS[decision].r;
                  }
                })
                .then(function() {
                  return sendMessageToDevice(evtJSON.ddid, craftLightDevice.state);
                })
                .catch(console.log);
              }
            }, 1000 * TICK);
            craftLightDevice.state.CurrentPresenceCount = _.size(persons);
            return p
            // 1 - update craft with new data
            .then(function() {
              return learning.updatePresenceState(craftLightDevice.state.CurrentPresenceCount);
            })
            // 2 - retrieve decision
            .then(function() {
              return learning.takeLightColorDecision();
            })
            .then(function(decision) {
              console.log('decision:', decision);
              if (!_.isUndefined(decision)) {
                craftLightDevice.state.PredictedLightRedComponent = COLORS[decision].r;
              }
            });
          default:
            return Promise.reject(new Error(v.name + ' is an unknwon action'));
        }
      }, Promise.resolve())
      .then(function() {
        return sendMessageToDevice(evtJSON.ddid, craftLightDevice.state);
      })
      .catch(console.log);
    }
  }
}

module.exports = start;
