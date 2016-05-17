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
 * User router
 * - to use shared authentication middleware function:
 *    '''var authenticate = require('./auth.js').authenticate;
 *       router.get(path, authenticate, <handler>);```
 */

/**
 * Export routers
 */
module.exports = [
	require('./auth.js').router,
	require('./reservation.js'),
	require('./insights.js'),
	require('./ui.js'),
];

