'use strict';

var dotenv = require('dotenv');
var _ = require('lodash');
var Moment = require('moment');
var craftai = require('craft-ai').createClient;
var baseModel = require('./data/model.json');
var context = require('./data/context.json');
var Promise = require('bluebird');

// Init craft ai client
dotenv.load();
var client = craftai({
  owner: process.env.CRAFT_OWNER,
  token: process.env.CRAFT_TOKEN,
  url: process.env.CRAFT_URL || 'https://beta.craft.ai',
});

var agents = {
  LightColor: _.cloneDeep(baseModel)
};

var CONFIDENCE = process.env.CONFIDENCE_THRESHOLD || 0;

function init() {
  return Promise.all(_.map(agents, function(model, id) {
    return client.destroyAgent(id);
  }))
  .then(function() {
    var ts = Moment().unix();
    var c = _.map(context, function(i) {
      i.timestamp = ts + i.timestamp;
      return i;
    });
    return Promise.all(_.map(agents, function(model, id) {
      model.output.push(id);
      return client.createAgent(model, id)
      .then(function(agent) {
        client.getAgentInspectorUrl(agent.id).then(function(url) {
          console.log('decision tree url for', agent.id + ':\n' + url);
        });
        return agent;
      })
      .then(function(agent) {
        return client.addAgentContextOperations(agent.id, c, true);
      })
      .catch(function(err) {
        return console.log('error at init while adding context operations', err);
      });
    }));
  });
}

function updatePresenceState(state) {
  console.log('updatePresenceState', state);
  return Promise.all(_.map(agents, function(model, id) {
    return client.addAgentContextOperations(id, [{
      timestamp: Moment().unix(),
      diff: {
        Presence: state
      }
    }]);
  }))
  .catch(function(err) {
    console.log('error at updatePresenceState while adding context operations', err);
  });
}

function updateLightState(state) {
  console.log('updateLightState', state);
  return Promise.all(_.map(agents, function(model, id) {
    return client.addAgentContextOperations(id, [{
      timestamp: Moment().unix(),
      diff: {
        LightColor: '' + state
      }
    }]);
  }))
  .catch(function(err) {
    console.log('error at updateLightState while adding context operations', err);
  });
}

function setInitialState(state) {
  console.log('setInitialState', state);
  var diff = {
    LightColor: '' + state.color,
    Presence: state.presence,
  };
  return Promise.all(_.map(agents, function(model, id) {
    return client.addAgentContextOperations(id, [{
      timestamp: Moment().unix(),
      diff: diff
    }], true);
  }))
  .catch(function(err) {
    console.log('error at setInitialState while adding context operations', err);
  });
}

function takeLightColorDecision() {
  console.log('takeLightColorDecision');
  var now = Moment().unix();
  // 1 - we retrieve the current context for the agent
  return client.getAgentContext('LightColor', now)
  // 2 - taking decisions based on the current context
  .then(function(context) {
    return client.computeAgentDecision('LightColor', now, context.context);
  })
  .then(function(decision) {
    if (decision.confidence > CONFIDENCE) {
      return decision.decision.LightColor;
    } else {
      return;
    }
  })
  .catch(function(err) {
    console.log('error while computing light color decision', err);
  });
}

module.exports = {
  createAgents: init,
  updatePresenceState: updatePresenceState,
  updateLightState: updateLightState,
  setInitialState: setInitialState,
  takeLightColorDecision: takeLightColorDecision
};
