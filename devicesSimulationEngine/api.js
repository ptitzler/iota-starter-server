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
 * Implements Simulation Engine REST APIs
 */
var router = module.exports = require('express').Router();
var basicAuth = require('basic-auth');
var appEnv = require("cfenv").getAppEnv();

var devicesManager = require('./devicesManager');

/*
 * Authentication
 */
// this values should be same as values in simulationClient.js
var API_KEY = "PUT_YOUR_OWN_API_KEY";
var API_TOKEN = "PUT_YOUR_OWN_API_TOKEN";
var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
var vcapSvc = userVcapSvc.devicesSimulation;
if (vcapSvc) {
	simulationCreds = vcapSvc[0];
	if(simulationCreds && !simulationCreds.url){
		API_KEY = simulationCreds.apiKey;
		API_TOKEN = simulationCreds.apiToken;
	}
}

var authenticate = function(req,res,next){
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
		return res.status(401).end();
	}
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if (user.name === API_KEY && user.pass === API_TOKEN) {
		return next();
	} else {
		return unauthorized(res);
	}
};

router.all('/*', authenticate );

/*
 * API implementations
 * - pass REST requrests to deviceManager
 */

router.post('/startSimulation', function(req, res) {
	if((!req.body.architecture || !req.body.simulation) && !req.body.simulationConfig)
		return res.status(400).send("bad params");
	if (!req.app.server) {
		console.error('Faild to start simulation due to missing app.server.');
		return res.status(500).send("Failed to start simulation engine.")
	}
	var config = (req.body.simulationConfig) ? req.body.simulationConfig : devicesManager.getSimulationConfig(req.body.architecture, req.body.simulation);
	var manager = devicesManager.createDeviceManager(config, req.app.server);
	return res.send({wsurl: manager.wsurl, architectureRevision: manager.architectureRevision, simulationRevision: manager.simulationRevision, deviceStatus: manager.getAllDevicesStatus()});
});

router.get('/simulationStatus/:simulationID', function(req, res) {
	var manager = devicesManager.getDeviceManager(req.params.simulationID);
	if(!manager)
		return res.send({running : false});
	return res.send({running : true, wsurl: manager.wsurl, architectureRevision: manager.architectureRevision, simulationRevision: manager.simulationRevision, deviceStatus: manager.getAllDevicesStatus()});
});

router['delete']('/terminateSimulation/:simulationID', function(req, res) {
	var manager = devicesManager.getDeviceManager(req.params.simulationID);
	if(!manager)
		return res.status(404).end();
	
	devicesManager.terminateSimualtion(req.params.simulationID);
	return res.send({terminated : true});
});
