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
 * REST apis for car devices
 */
var router = module.exports = require('express').Router();
var devices = require('../../devices/devices.js');
var debug = require('debug')('device');
debug.log = console.log.bind(console);

/**
 * get all devices
 */
router.get('/device', /*authenticate, */function(req,res) {
	var options = {sortBy: req.query.sortBy, page: req.query.page, pageUnit: req.query.pageUnit};
	devices.getAllDevices(options).then(function(results) {
		res.send(results);
	})['catch'](function(err){
		res.status((err&&(err.status||err.statusCode))||500).send(err);
	});
});
