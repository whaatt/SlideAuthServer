/*
 * File: auth.js
 * Type: Handler Functions
 * Contains auth functions.
 */

// For sanity.
'use strict';

// Useful imports for building auth handler functions.
const Users = require('../helpers/database.js').Users
const validate = require('jsonschema').validate;
const API = require('../helpers/API.js');
const UUID = require('uuid/v4');

// Responds to Deepstream as an auth handler, so this API
// endpoint is NOT to be used by the React Native application.
module.exports.login = (event, context, callback) => {
  const body = JSON.parse(event.body);
  let response; // Response object.

  // Make sure this is
  // a Deepstream request.
  if (!body.authData ||
      !body.authData.UUID ||
      !body.authData.username)
    callback(null, API.errors.validation);

  else {
    let returnToDS = {
      // The data that Deepstream will
      // store in local memory about user.
      username: body.authData.username,
      serverData: {},
      clientData: {}
    };

    // Check if credentials are valid, then re-read
    // the user and add tempUsername to serverData.
    Users.verify(body.authData, (error, exists) => {
      if (error) callback(null, API.errors.database);
      else if (!exists) callback(null, API.errors.credentials);
      else Users.read(body.authData.username, (error, data) => {
        if (error) callback(null, API.errors.database);
        returnToDS.serverData.tempUsername = data.tempUsername;
        callback(null, API.response(200, returnToDS, true));
      });
    });
  }
};
