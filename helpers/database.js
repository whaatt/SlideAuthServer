/* 
 * File: database.js
 * Type: Helper Functions
 * Contains DB client.
 *
 * Note: Currently, this library does
 * not support transactions. If we ever
 * scale up really large, this is something
 * that we definitely need.
 */

// For sanity.
'use strict';

// Set up the DynamoDB client.
const AWS = require('aws-sdk');
const DB = new AWS.DynamoDB.DocumentClient();

// Database helper module.
module.exports = { Users: {} };

// Used in getting a user.
const userAttributes = [
  'username',
  'anonymous',
  'tempUsername',
  'UUID',
  'name'
];

// Maps objects to AWS-style updates.
const mapToUpdates = (original) => {
  let mapped = {};
  for (const prop in original) {
    mapped[prop] = {
      Action: 'PUT',
      Value: original[prop]
    };
  }

  // Used by DBClient.update.
  return mapped
};

// Calls back with whether username exists.
module.exports.Users.exists = (username, call) => {
  // TODO: Remove this line once handlers are restructured.
  if (username === undefined) call(null, false);

  else {
    // DynamoDB parameters.
    const params = {
      ConsistentRead: true,
      TableName: 'streamers',
      Key: { username: username },
      AttributesToGet: ['username']
    };

    // Check if the username exists.
    DB.get(params, (error, data) => {
      const exists = !!data.Item;
      if (!error) call(error, exists);
      else call(error, null);
    });
  }
};

// Calls back if all user credentials correct
// and the given user is not an anonymous user.
module.exports.Users.verify = (user, call) => {
  // DynamoDB parameters.
  const params = {
    ConsistentRead: true,
    TableName: 'streamers',
    Key: { username: user.username },
    AttributesToGet: ['username', 'UUID']
  };

  // Check credentials on username.
  DB.get(params, (error, data) => {
    const exists = !!data.Item;
    if (error) call(error, null);
    else if (!exists) call(error, false);
    else if (data.Item.anonymous === true)
      call(error, false)
    else if (data.Item.UUID !== user.UUID)
      call(error, false);
    else call(error, true);
  });
};

// Calls back with true if create succeeds.
module.exports.Users.create = (user, call) => {
  // DynamoDB parameters.
  const params = {
    TableName: 'streamers',
    Item: user
  };

  // Actually perform the create.
  DB.put(params, (error, data) => {
    if (error) call(error, false);
    else call(error, true);
  });
};

// Reads all attributes of a user from the DB.
module.exports.Users.read = (username, call) => {
  // DynamoDB parameters.
  const params = {
    ConsistentRead: true,
    TableName: 'streamers',
    Key: { username: username },
    AttributesToGet: userAttributes
  };

  // Check credentials on username.
  DB.get(params, (error, data) => {
    if (error) call(error, null);
    else if (!data.Item) call(true, null);
    else call(error, data.Item);
  });
};

// Get information about several users (like in a room) at once.
module.exports.Users.batchReadPublic = (users, call) => {
  // DynamoDB parameters.
  const params = {
    ConsistentRead: true,
    RequestItems: {
      streamers: {
        Keys: users.map(user => 
          ({ username: user })),
        AttributesToGet: [
          'username',
          'tempUsername',
          'name'
        ]
      }
    }
  };

  DB.batchGet(params, (error, data) => {
    if (error) call(error, null);
    else call(error, data.Responses.streamers);
  });
};

// Updates the user given by username with parameters in properties.
module.exports.Users.update = (username, properties, call) => {
  const newUsername = properties.newUsername;
  delete properties.newUsername;

  // DynamoDB parameters.
  const params = {
    TableName: 'streamers',
    Key: { username: username },
    AttributeUpdates: mapToUpdates(properties)
  };

  // DynamoDB does not allow updates
  // to the primary key of an entry.
  if (newUsername !== undefined) {
    const deleteParams = {
      TableName: 'streamers',
      Key: { username: username }
    };

    DB.delete(deleteParams, (error, data) => {
      if (error) call(error, null);
      else DB.update(params, (error, data) => {
        if (error) call(error, null);
        else call(error, true);
      });
    });
  }

  // Perform the update and return true.
  DB.update(params, (error, data) => {
    if (error) call(error, null);
    else call(error, true);
  });
};

// Calls back with true if delete succeeds.
module.exports.Users.delete = (username, call) => {
  // DynamoDB parameters.
  const params = {
    TableName: 'streamers',
    Key: { username: username }
  };

  // Actually perform the create.
  DB.delete(params, (error, data) => {
    if (error) call(error, false);
    else call(error, true);
  });
};
