/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var router = module.exports = require('express').Router();
var jsonParser = require('body-parser').json();

// user repository
var userRepository = {
	// users are added as below
	// "tom":  { password: "tom" , displayName: "Tom" , dob:"Janualy 1, 2016"}
}

router.post('/:tenantId/:realmName/startAuthorization', jsonParser, function(req, res){
	var tenantId = req.params.tenantId;
	var realmName = req.params.realmName;
	var headers = req.body.headers;

	console.log("startAuthorization", tenantId, realmName, headers);

	var responseJson = {
		status: "challenge",
		challenge: {
			text: "Enter username and password."
		}
	};

	res.status(200).json(responseJson);
});

router.post('/:tenantId/:realmName/handleChallengeAnswer', jsonParser, function(req, res){
	var tenantId = req.params.tenantId;
	var realmName = req.params.realmName;
	var challengeAnswer = req.body.challengeAnswer;


	console.log("handleChallengeAnswer", tenantId, realmName, challengeAnswer);

	var username = req.body.challengeAnswer["username"];
	var password = req.body.challengeAnswer["password"];

	var responseJson = { status: "failure" };

    // add a new user when the username does not exist in user repository except ""
    if (username != "" && userRepository[username] == null) {
        userRepository[username]={password: password, displayName: username, dob:"Janualy 1, 2016"};
        console.log("A new userId is added ::", username);
    }

	var userObject = userRepository[username];
	if (userObject && userObject.password == password ){
		console.log("Login success for userId ::", username);
		responseJson.status = "success";
		responseJson.userIdentity = {
			userName: username,
			displayName: userObject.displayName,
			attributes: {
				dob: userObject.dob
			}
		}
	} else {
		console.log("Login failure for userId ::", username);
		var responseJson = {
			status: "challenge",
			challenge: {
				text: "Login failed. Re-enter username and password."
			}
		};
	}

	res.status(200).json(responseJson);
});
