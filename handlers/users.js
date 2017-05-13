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
    let now = (new Date).getTime();

    // Generate new user.
    const newUser = {
      username: UUID(),
      anonymous: true,
      temporary: false,
      linked: null,
      timestamp: now,
      name: name,
      UUID: UUID()
    };

    // Check if username exists (by chance) and create
    // it if it does not exist. First check should pass.
    Users.exists(newUser.username) // Should just run.
      .then((exists) => {
        if (exists) throw API.errors.duplicate;
        else return true; // True for no problem.
      })
      .then((data) => Users.create(newUser))
      .then((data) => { callback(null, API.response(200, newUser)) })
      .catch((error) => { callback(null, error) });
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
      },
      temporary: {
        type: 'boolean',
        required: true
      },
      linked: {
        type: 'string',
        required: false
      },
      linkedUUID: {
        type: 'string',
        required: false
      },
      controlUUID: {
        type: 'string',
        required: false
      }
    }
  };

  // Perform input validation.
  let result = validate(body, schema);
  if (!result.valid) // See result.errors.
    callback(null, API.errors.validation);
  else if ((body.linked && !body.linkedUUID) ||
      (!body.linked && body.linkedUUID))
    callback(null, API.errors.validation);

  else {
    // Extract attributes.
    let username = body.username;
    let temporary = body.temporary;
    let linkedUUID = body.linkedUUID;
    let controlUUID = body.controlUUID;
    let now = (new Date).getTime();
    let linked = body.linked;
    let name = body.name;

    // Generate new user.
    const newUser = {
      username: username,
      anonymous: false,
      temporary: temporary,
      linked: linked || null,
      timestamp: now,
      name: name,
      UUID: UUID()
    };

    // Always check linkage first. Then check if the
    // username to be created exists, and only relax
    // this requirement to inactive accounts if the
    // target username in question has been inactive.
    let linkage = linked !== undefined
      ? (() => Users.exists(linked)
        .then((exists) => {
          if (exists) return Users.read(linked);
          else throw API.errors.credentials;
        })
        .then((user) => {
          // Linkee must be permanent.
          if (user.temporary)
            throw API.errors.credentials;
          // You can only link with your accounts.
          else if (user.UUID !== linkedUUID)
            throw API.errors.credentials;
          // You can only link temporary accounts.
          else if (!temporary)
            throw API.errors.validation;
          else return true;
        }))
      // No issues with linkage to deal with.
      : (() => Promise.resolve(true));

    console.log(linkage);

    // User creation promise. See decision tree above.
    let creation = () => Users.exists(newUser.username)
      .then((exists) => {
        // User nonexistent. Simply create new user.
        if (!exists) return Users.create(newUser);
        // If user exists, allow creation if
        // user was temporary, and either you
        // used to control the user (you are
        // simply renewing it) OR user inactive.
        else return Users.read(newUser.username)
          .then((user) => {
            if (user.temporary &&
                ((controlUUID && user.UUID === controlUUID) ||
                 now - user.timestamp > 24 * 60 * 60 * 1000)) {
              let updateProps = Object.assign({}, newUser);
              delete updateProps.username; // Separate in update.
              return Users.update(username, updateProps);
            } else {
              // No way to take control.
              throw API.errors.duplicate;
            }
          });
      });

    // Run the promise chain.
    linkage().then((data) => creation())
      .then((data) => { callback(null, API.response(200, newUser)); })
      .catch((error) => { callback(null, error); });
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
    let now = (new Date).getTime();
    let UUID = body.UUID;
    let name = body.name;

    // User to be edited.
    const editUser = {
      username: username,
      UUID: UUID
    };

    const updates = { timestamp: now };
    // Add optional attributes to our updated user object.
    if (newUsername !== undefined) updates.newUsername = newUsername;
    if (name !== undefined) updates.name = name;

    // Verify user credentials, then try to make
    // updates, trying to avoid duplicates as we go.
    Users.verify(editUser, true)
      .then((valid) => {
        if (!valid) throw API.errors.credentials;
        else return true;
      })
      .then((data) => Users.update(username, updates))
      .then((data) => { callback(null, API.response(200, data)) })
      .catch((error) => { callback(null, error) });
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
    Users.batchReadPublic(users)
      .then((data) => {
        const returned = { data: data,
          partial: data.length < users.length };
        callback(null, API.response(200, returned));
      })
      .catch((error) => { callback(null, error) });
  }
};
