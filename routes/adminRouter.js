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
var adminRouter = module.exports = require('express').Router();
var basicAuth = require('basic-auth');
var qr = require('qr-image');
var WebSocketServer = require('ws').Server;
var appEnv = require("cfenv").getAppEnv();

var IOTF = require('../watsonIoT');
var connectedDevices = require('../workbenchLib').connectedDevicesCache;
var driverInsightsAnalyze = require('../driverInsights/analyze');
var driverInsightsTripRoutes = require('../driverInsights/tripRoutes.js');
var dbClient = require('../cloudantHelper.js');

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
adminRouter.get('/qr/getPlatformCredentials', /*authenticate,*/ function(req, res) {
	var text = ['1', appEnv.url].join(',');
	
	var img = qr.image(text, { type: 'png', ec_level: 'H', size: 3, margin: 0 });
	res.writeHead(200, {'Content-Type': 'image/png'})
	img.pipe(res);
});

//
// Monitoring utilities
//
adminRouter.get('/connectedDevices', authenticate, function(req,res){
	res.send(connectedDevices.getConnectedDevices());
});

adminRouter.get('/iotConfig', authenticate, function(req,res){
	res.send(IOTF.devicesConfigs);
});

adminRouter.get('/allReservations', authenticate, function(req,res){
	_getReservations("allReservations", res);
});

adminRouter.get('/activeReservations', authenticate, function(req,res){
	_getReservations("activeReservations", res);
});

adminRouter.get('/closedReservations', authenticate, function(req,res){
	_getReservations("closedReservations", res);
});

function _getReservations(scope, res){
	dbClient.searchView(scope, {}).then(function(result){
		var reservations = result.rows.map(function(item){
			return item.value;
		});
		res.send(reservations);
	})["catch"](function(error){
		res.send(error);
	});
};

adminRouter.get('/driverInsights', authenticate, function(req, res) {
	driverInsightsAnalyze.getList().then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

adminRouter.get('/driverInsights/behaviors', authenticate, function(req, res) {
	driverInsightsAnalyze.getTripList().then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		res.send(error);
	});
});

adminRouter.get('/tripId', authenticate, function(req, res) {
	driverInsightsTripRoutes._searchTripsIndex({q:'*:*', sort:'-org_ts', limit:100})
	.then(function(result){
		res.send(result.rows.map(function(row){return row.fields;}));
	})['catch'](function(err){
		res.status(500).send(err);
	}).done();
});

/**
 * Start messages monitor wss server and show the Messages Monitor page
 */
adminRouter.get('/messagesMonitor', authenticate, function(req,res){
	if (!req.app.server) {
		console.error('adminRouter failed to create WebSocketServer due to missing app.server');
		res.status(500).send('Filed to start wss server in adminRouter.')
	} else {
		initWebSocketServer(req.app.server, req.originalUrl);
		res.render('messagesMonitor', { appName: appEnv.name, iotconfig: IOTF.devicesConfigs });
	}
});

//shared web socket server instance
adminRouter.prototype.wssServer = null;

//open wed socket server for messages monitoring on top of `server` at `path`.
var initWebSocketServer = function (server, path){
	if(adminRouter.prototype.wssServer !== null){
		return; //already created
	}
	//create websocket server
	adminRouter.prototype.wssServer = new WebSocketServer({
		server: server,
		path : path,
		verifyClient : function (info, callback) { //only allow internal clients from the server origin
			var localhost = 'localhost';
			var isLocal = appEnv.url.toLowerCase().indexOf(localhost, appEnv.url.length - localhost.length) !== -1;
			var allow = isLocal || (info.origin.toLowerCase() === appEnv.url.toLowerCase());
			if(!allow){
				console.error("rejected web socket connection form external origin " + info.origin + " only connection form internal origin " + appEnv.url + " are accepted");
			}
			if(!callback){
				return allow;
			}
			var statusCode = (allow) ? 200 : 403;
			callback (allow, statusCode);
		}
	});

	//listen to messages monitor
	var messagesMonitor = require('../workbenchLib').messagesMonitor;
	messagesMonitor.addListener(function(msg){
		adminRouter.prototype.wssServer.clients.forEach(function each(client) {
			try {
				client.send(JSON.stringify(msg));
			} catch (e) {
				console.error(e);
			}
		});
	});
};
