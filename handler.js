/* 
 * Passthrough Authenticator
 * AWS Lambda Function
 * By Sanjay Kannan
 */

// For sanity.
'use strict';

// Just spits the user token back to Deepstream. The only
// validation we do here is making sure the token is well-formed.
module.exports.authenticate = (event, context, callback) => {
  const body = JSON.parse(event.body)
  let response; // Response object.
  if (!body.authData || // Not from Deepstream.
      !body.authData.UUID || // No UUID provided.
      body.authData.UUID.length < 10 || // UUID too short.
      body.authData.UUID.length > 30 ) { // UUID too long.
    response = {
      statusCode: 401,
      body: JSON.stringify({
        message: 'Invalid auth info.'
      })
    }
  } else {
    response = {
      statusCode: 200,
      body: JSON.stringify({
        userId: 'generic',
        clientData: { message : 'Valid UUID.' },
        serverData: { UUID : body.authData.UUID }
      })
    };
  }

  // Trigger the response.
  callback(null, response);
};
