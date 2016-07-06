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

var modalCalls = document.querySelectorAll('.em-Modal-Call');
var modalCallsArray = Array.prototype.slice.call(modalCalls, 0);

modalCallsArray.forEach(function(el) {
    if (document.getElementById(el.rel)) {
        el.onclick=function(e){
            e.preventDefault();

            document.getElementById(el.rel).classList.add('em-Modal-show');
            document.getElementById(el.rel).querySelector('.em-Modal-Content').classList.add('em-Modal-Content-show');
            document.getElementById(el.rel).querySelector('.em-Modal-Close').classList.add('em-Modal-Close-show');

            var close = function(event) {
                if (event) {
                    event.preventDefault();
                }

                document.getElementById(el.rel).querySelector('.em-Modal-Close').classList.remove('em-Modal-Close-show');
                document.getElementById(el.rel).classList.remove('em-Modal-show');
                document.getElementById(el.rel).querySelector('.em-Modal-Content').classList.remove('em-Modal-Content-show');
                
                document.querySelector('header').classList.remove('blur');
                document.querySelector('.content').classList.remove('blur');
            };

            document.onkeydown = function(event) {
                event = event || window.event;
                if (event.keyCode == 27) {
                    close();
                }
            };

            document.getElementById(el.rel).querySelector('.em-Modal-Content .em-Modal-Close').addEventListener("click", close);
            
            Array.prototype.slice.call(document.querySelectorAll('.em-Modal-Content ul.modalMenu a'), 0).forEach(function(modalLink) {
                modalLink.addEventListener("click", close);
            });
            
            document.querySelector('header').classList.add('blur');
            document.querySelector('.content').classList.add('blur');
        };
    }
});