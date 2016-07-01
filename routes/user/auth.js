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
 * Provides authorization router and function
 * Exports: router: Router
 *          authenticate: Authenticate function
 */
var router = module.exports.router = require('express').Router();
var session = require('express-session');
var sessionStore  = new session.MemoryStore;
var passport = require('passport');
var appEnv = require("cfenv").getAppEnv();

if(process.env.MCA_AUTHENTICATION === "true"){
	var MCABackendStrategy = require('bms-mca-token-validation-strategy').MCABackendStrategy;
	passport.use(new MCABackendStrategy());
}

//get DB client
var dbClient = require('../../cloudantHelper.js');
var DB = null;
dbClient.getDBClient().then(function(db){
	DB = db;
});

passport.serializeUser(function(user, done) {
	user.type = "user";
	user._id = user.id;
	DB.insert(user ,null, function(err, doc){
		done(null, user);
	});
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

/*
 * setup app
 */
var app = require('../../app.js');
app.use(session({
	key: 'JSESSIONID',
	store: sessionStore,
	secret: 'connectedcarstarterappuserapi',
	saveUninitialized: true,
	resave: true,
	proxy: true,
	cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());


var authenticate = function(req,res,next){
//	console.log("request: " + JSON.stringify(req.headers));
	if(process.env.MCA_AUTHENTICATION !== "true") {
		//attach debug user to session
		var user_id = req.get("iota-starter-uuid") || "demo_user";
		req.user = {_id: user_id, id: user_id, displayName: user_id};
	}

	if(!req.user && req.session.user)//copy user from session
		req.user = req.session.user;

	if(req.user)//authenticated request move on
		next();
	else //authenticate  first
		passport.authenticate('mca-backend-strategy', {session: false })(req,res,next);
};
module.exports.authenticate = authenticate; // export the authentication router

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

