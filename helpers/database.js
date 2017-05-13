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
const API = require('../helpers/API.js');

// Database helper module.
module.exports = { Users: {} };
const tableName = process.env.TABLE_NAME;

// Used in getting a user.
const userAttributes = [
  'username',
  'timestamp',
  'temporary',
  'anonymous',
  'linked',
  'UUID',
  'name'
];

// Returned for public batch calls.
const publicAttributes = [
  'username',
  'linked',
  'name'
];

// Used to verify credentials.
const verifyAttributes = [
  'username',
  'temporary',
  'anonymous',
  'UUID'
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

// Returns a promise with whether username exists.
module.exports.Users.exists = (username) => {
  // DynamoDB parameters.
  const readParams = {
    ConsistentRead: true,
    TableName: tableName,
    Key: { username: username },
    AttributesToGet: ['username']
  };

  // Check if the username exists.
  return DB.get(readParams).promise()
    .then((data) => {
      const exists = !!data.Item;
      return exists;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Returns promise with whether credentials correct.
module.exports.Users.verify = (user, forEdit) => {
  // DynamoDB parameters.
  const readParams = {
    ConsistentRead: true,
    TableName: tableName,
    Key: { username: user.username },
    AttributesToGet: verifyAttributes
  };

  // Check credentials on username.
  return DB.get(readParams).promise()
    .then((data) => {
      const exists = !!data.Item;
      // User does not even exist.
      if (!exists) return false;
      // No editing of temporary users.
      else if (forEdit && data.Item.temporary === true)
        return false;
      // No editing of anonymous users.
      else if (forEdit && data.Item.anonymous === true)
        return false;
      // UUID password was incorrect.
      else if (data.Item.UUID !== user.UUID)
        return false;
      // Credentials correct.
      else return true;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Returns promise true if create succeeds.
module.exports.Users.create = (user) => {
  // DynamoDB parameters.
  const putParams = {
    TableName: 'streamers',
    Item: user
  };

  // Actually perform the create.
  return DB.put(putParams).promise()
    .then((data) => {
      // Create succeeded.
      return true;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Promises all attributes of a user from DB.
module.exports.Users.read = (username) => {
  // DynamoDB parameters.
  const readParams = {
    ConsistentRead: true,
    TableName: 'streamers',
    Key: { username: username },
    AttributesToGet: userAttributes
  };

  // Check credentials on username.
  return DB.get(readParams).promise()
    .then((data) => {
      // Take care of potential data races.
      if (!data.Item) throw API.errors.database;
      else return data.Item;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Get information about several users at once.
module.exports.Users.batchReadPublic = (users) => {
  // DynamoDB parameters.
  const readParams = {
    ConsistentRead: true,
    RequestItems: {
      streamers: {
        Keys: users.map(user => ({ username: user })),
        AttributesToGet: publicAttributes
      }
    }
  };

  // Get several items from DB at once.
  return DB.batchGet(readParams).promise()
    .then((data) => {
      // DB only returns data for valid users.
      return data.Responses.streamers;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Updates the given username with parameters in properties.
module.exports.Users.update = (username, properties) => {
  const newUsername = properties.newUsername;
  delete properties.newUsername;

  // DynamoDB parameters.
  const updateParams = {
    TableName: 'streamers',
    Key: { username: newUsername || username },
    AttributeUpdates: mapToUpdates(properties)
  };

  // If we are updating newUsername, we have
  // to create the new user first, delete the
  // old user, and then perform update. If not
  // we can just update the user ordinarily.
  return new Promise((resolve, reject) => {
    if (newUsername !== undefined) {
      const deleteParams = {
        TableName: 'streamers',
        Key: { username: username }
      };

      // Save user data from the old username.
      module.exports.Users.read(username)
        .then((userData) => {
          // Patch new username into saved data.
          userData.username = newUsername;

          // DynamoDB parameters.
          const createParams = {
            TableName: 'streamers',
            Item: userData
          };

          // Create the new username record.
          return DB.put(createParams).promise();
        })
        .then((data) => {
          // Delete the old username record.
          resolve(DB.delete(deleteParams).promise());
        });
    } else {
      // Do nothing.
      resolve(true);
    }
  })
    .then((data) => {
      // Perform the update on new or old user.
      return DB.update(updateParams).promise();
    })
    .then((data) => {
      properties.newUsername = newUsername;
      return properties;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};

// Returns a Promise with true if delete succeeds.
module.exports.Users.delete = (username, call) => {
  // DynamoDB parameters.
  const deleteParams = {
    TableName: 'streamers',
    Key: { username: username }
  };

  // Actually perform the delete.
  return DB.delete(params).promise()
    .then((data) => {
      // Delete succeeded.
      return true;
    })
    .catch((error) => {
      // API error response object.
      throw API.errors.database;
    });
};
