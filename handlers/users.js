/* 
 * File: users.js
 * Type: Handler Functions
 * Contains user functions.
 */

// For sanity.
'use strict';

// Useful imports for building user handler functions.
const Users = require('../helpers/database.js').Users
const validate = require('jsonschema').validate;
const API = require('../helpers/API.js');
const UUID = require('uuid/v4');

// Generates a temporary username and UUID for an anonymous
// user in the browser and stores these credentials in DB.
module.exports.anonymous = (event, context, callback) => {
  const body = JSON.parse(event.body);
  let response; // Response object.

  // Validation schema.
  const schema = {
    type: 'Object',
    properties: {
      name: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 40
      }
    }
  };

  // Perform input validation.
  let result = validate(body, schema);
  if (!result.valid) // See result.errors.
    callback(null, API.errors.validation);

  else {
    // Extract attributes.
    let name = body.name;

    // Generate new user.
    const newUser = {
      username: UUID(),
      tempUsername: null,
      anonymous: true,
      name: name,
      UUID: UUID()
    };

    // Check if username exists (by chance) and create
    // it if it does not exist. First check should pass.
    Users.exists(newUser.username, (error, exists) => {
      if (error) callback(null, API.errors.database);
      else if (exists) callback(null, API.errors.duplicate);
      else Users.create(newUser, (error, data) => {
        if (error) callback(null, API.errors.database);
        else callback(null, API.response(200, newUser));
      });
    });
  }
};

// Register an new user and return their credentials.
module.exports.register = (event, context, callback) => {
  const body = JSON.parse(event.body);
  let response; // Response object.

  // Validation schema.
  const schema = {
    type: 'Object',
    properties: {
      username: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 40
      },
      name: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 40
      }
    }
  };

  // Perform input validation.
  let result = validate(body, schema);
  if (!result.valid) // See result.errors.
    callback(null, API.errors.validation);

  else {
    // Extract attributes.
    let username = body.username;
    let name = body.name;

    // Generate new user.
    const newUser = {
      username: username,
      tempUsername: null,
      anonymous: false,
      name: name,
      UUID: UUID()
    };

    // Check if username exists (by chance), and create
    // it if it does not exist. First check should pass.
    Users.exists(newUser.username, (error, exists) => {
      if (error) callback(null, API.errors.database);
      else if (exists) callback(null, API.errors.duplicate);
      else Users.create(newUser, (error, data) => {
        if (error) callback(null, API.errors.database);
        else callback(null, API.response(200, newUser));
      });
    });
  }
};

// Update an existing user and return a generated UUID password.
module.exports.update = (event, context, callback) => {
  const body = JSON.parse(event.body);
  let response; // Response object.

  // Validation schema.
  const schema = {
    type: 'Object',
    properties: {
      username: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 40
      },
      UUID: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 40
      },
      name: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 40
      },
      tempUsername: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 40
      },
      newUsername: {
        type: 'string',
        required: false,
        minLength: 1,
        maxLength: 40
      }
    }
  };

  // Perform input validation.
  let result = validate(body, schema);
  if (!result.valid) // See result.errors.
    callback(null, API.errors.validation);

  else {
    // Extract attributes.
    let username = body.username;
    let newUsername = body.newUsername;
    let tempUsername = body.tempUsername;
    let UUID = body.UUID;
    let name = body.name;

    // User to be edited.
    const editUser = {
      username: username,
      UUID: UUID
    };

    const updates = {};
    // Add optional attributes to our updated user object.
    if (tempUsername !== undefined) updates.tempUsername = tempUsername;
    if (name !== undefined) updates.name = name;

    // Verify user credentials, then try to make
    // updates, trying to avoid duplicates as we go.
    Users.verify(editUser, (error, exists) => {
      if (error) callback(null, API.errors.database);
      else if (!exists) callback(null, API.errors.credentials);
      // Check if the given tempUsername (or undefined) is a duplicate.
      else Users.exists(updates.tempUsername, (error, exists) => {
        if (error) callback(null, API.errors.database);
        else if (exists) callback(null, API.errors.duplicate);
        // Check if the given newUsername (or undefined) is a duplicate.
        else Users.exists(newUsername, (error, exists) => {
          if (error) callback(null, API.errors.database);
          else if (exists) callback(null, API.errors.duplicate);

          // If changing username, save the old record, delete
          // it, and then create a new user with record data.
          else if (newUsername !== undefined)
            Users.read(username, (error, changedUser) => {
              if (error) callback(null, API.errors.database);
              else Users.delete(username, (error, data) => {
                changedUser.username = newUsername;
                if (error) callback(null, API.errors.database);
                Users.create(changedUser, (error, data) => {
                  if (error) callback(null, API.errors.database);
                  else callback(null, API.response(200, changedUser));
                });
              });
            });

          // Finally create the user if all the checks succeed.
          // TODO: Restructure this to use sequential Promises.
          else Users.update(username, updates, (error, data) => {
            if (error) callback(null, API.errors.database);
            else callback(null, API.response(200, updates));
          });
        });
      });
    });
  }
};

// Read a batch of users and their public information.
module.exports.batch = (event, context, callback) => {
  const body = JSON.parse(event.body);
  let response; // Response object.

  // Validation schema.
  const schema = {
    type: 'Object',
    properties: {
      users: {
        type: 'array',
        required: true,
        items: { type: 'string' },
        maxItems: 20
      }
    }
  };

  // Perform input validation.
  let result = validate(body, schema);
  if (!result.valid) // See result.errors.
    callback(null, API.errors.validation);

  else {
    // Extract attributes.
    let users = body.users;

    // Perform the read using BatchGetItem.
    Users.batchReadPublic(users, (error, data) => {
      if (error) callback(null, API.errors.database);
      else {
        const returned = { data: data,
          partial: data.length < users.length };
        callback(null, API.response(200, returned));
      }
    });
  }
};
