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
 * Routes to show UIs
 */
var uiRouter = module.exports = require('express').Router();
var authenticate = require('./auth.js').authenticate;

uiRouter.get('/ui/statistics', /* authenticate, */ function(req, res) {
	res.render("statistics", {});
});

uiRouter.get('/ui/trips', /* authenticate, */ function(req, res) {
	res.render("trips", {});
});

uiRouter.get('/ui/behaviors', /* authenticate, */ function(req, res) {
	res.render("behaviors", {"trip_uuid":"latest"});
});

uiRouter.get('/ui/behaviors/:trip_uuid', /* authenticate, */ function(req, res) {
	res.render("behaviors", {"trip_uuid":req.params.trip_uuid});
});

uiRouter.get('/ui/behaviorsmap', /* authenticate, */ function(req, res) {
	res.render("behaviorsmap", {"trip_uuid":"latest"});
});

uiRouter.get('/ui/behaviorsmap/:trip_uuid', /* authenticate, */ function(req, res) {
	res.render("behaviorsmap", {"trip_uuid":req.params.trip_uuid});
});

uiRouter.get('/ui/dashboard', /* authenticate, */ function(req, res) {
	res.render("dashboard", {});
});

uiRouter.get('/ui/listpage', /* authenticate, */ function(req, res) {
	res.render("listpage", {});
});

