'use strict';

var dotenv = require('dotenv');
var Moment = require('moment');
var craftai = require('craft-ai').createClient;

// Init craft ai client
dotenv.load();

var client = craftai({
  owner: process.env.CRAFT_OWNER,
  project: process.env.CRAFT_PROJECT,
  token: process.env.CRAFT_TOKEN,
});

var agent = {
  config: {
    context: {
      Presence: {
        type: 'continuous'
      },
      LightColor: {
        type: 'enum'
      }
    },
    output: ['LightColor'],
    time_quantum: 3,
    learning_period: 1080
  }
};

var context = [
  {
    timestamp: Moment().unix() - 80,
    context: {
      LightColor: 'red',
      Presence: 0
    }
  }
];

var CONFIDENCE = process.env.CONFIDENCE_THRESHOLD || 0;

function init(id) {
  return client.destroyAgent(id)
  .then(function() {
    agent.id = id;
    return client.createAgent(agent.config, id)
    .then(function() {
      return client.addAgentContextOperations(id, context, true);
    })
    .catch(function(err) {
      return console.log('error at init while adding context operations', err);
    });
  });
}

function updatePresenceState(state) {
  console.log('updatePresenceState', state);
  return client.addAgentContextOperations(agent.id, [{
    timestamp: Moment().unix(),
    context: {
      Presence: state
    }
  }])
  .catch(function(err) {
    console.log('error at updatePresenceState while adding context operations', err);
  });
}

function updateLightState(state) {
  console.log('updateLightState', state);
  return client.addAgentContextOperations(agent.id, [{
    timestamp: Moment().unix(),
    context: {
      LightColor: '' + state
    }
  }])
  .catch(function(err) {
    console.log('error at updateLightState while adding context operations', err);
  });
}

function takeLightColorDecision() {
  console.log('takeLightColorDecision');
  var now = Moment().unix();
  // 1 - we retrieve the current context for the agent
  return client.getAgentContext(agent.id, now)
  // 2 - taking decisions based on the current context
  .then(function(context) {
    return client.computeAgentDecision(agent.id, now, context.context);
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
  craftClient: client,
  createAgent: init,
  updatePresenceState: updatePresenceState,
  updateLightState: updateLightState,
  takeLightColorDecision: takeLightColorDecision
};
