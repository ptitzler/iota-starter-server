/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
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

/*
 * Implements admin utilities, qr-code generator and messages monitor.
 */
var router = require('express').Router();
var basicAuth = require('basic-auth');
var qr = require('qr-image');
var appEnv = require("cfenv").getAppEnv();

var ADMIN_USER     = "ADMIN";
var ADMIN_PASSWORD = "ADMIN";

//basic authentication
var authenticate = function(req,res,next){
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required. Default apssword is ADMIN');
		return res.status(401).end();
	}
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if (user.name === ADMIN_USER && user.pass === ADMIN_PASSWORD) {
		return next();
	} else {
		return unauthorized(res);
	}
};

/**
 * Get the QR Code image for mobile app to connect to platform
 */
router.get('/qr/getPlatformCredentials', /*authenticate,*/ function(req, res) {
	var route = appEnv.url;
	var guid = appEnv.app.application_id;
	var mca_auth = (process.env.MCA_AUTHENTICATION === "true") ? "true" : "false";
	
	var text;
	if (mca_auth == "false") {
		text = ['1', route, guid].join(',');
	} else {
		text = ['1', route, guid, mca_auth].join(',');
	}
	
	var img = qr.image(text, { type: 'png', ec_level: 'H', size: 3, margin: 0 });
	res.writeHead(200, {'Content-Type': 'image/png'})
	img.pipe(res);
});

router.get('/login', authenticate, function(req, res) {
	if(req.user){
		console.log(req.user);
		req.session.user = req.user;
	}
	else
		console.log("req.user is undefined");
	res.send({message: "authenticated", user: req.user});
});

router.get('/logout', function (req, res){
	if(req.user)
		delete req.user;
	req.logout();
	if(req.session)
		req.session.destroy(function (err) {
			return res.send("logged out");
		});
	else
		return res.send("logged out");
});

module.exports.router = router;
module.exports.authenticate = authenticate; // export the authentication router
