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



/*! modernizr 3.3.1 (Custom Build) | MIT *
 * https://modernizr.com/download/?-cssanimations-csstransforms-opacity-setclasses !*/
!function(e,n,t){function s(e,n){return typeof e===n}function r(){var e,n,t,r,o,i,a;for(var l in C)if(C.hasOwnProperty(l)){if(e=[],n=C[l],n.name&&(e.push(n.name.toLowerCase()),n.options&&n.options.aliases&&n.options.aliases.length))for(t=0;t<n.options.aliases.length;t++)e.push(n.options.aliases[t].toLowerCase());for(r=s(n.fn,"function")?n.fn():n.fn,o=0;o<e.length;o++)i=e[o],a=i.split("."),1===a.length?Modernizr[a[0]]=r:(!Modernizr[a[0]]||Modernizr[a[0]]instanceof Boolean||(Modernizr[a[0]]=new Boolean(Modernizr[a[0]])),Modernizr[a[0]][a[1]]=r),g.push((r?"":"no-")+a.join("-"))}}function o(e){var n=_.className,t=Modernizr._config.classPrefix||"";if(x&&(n=n.baseVal),Modernizr._config.enableJSClass){var s=new RegExp("(^|\\s)"+t+"no-js(\\s|$)");n=n.replace(s,"$1"+t+"js$2")}Modernizr._config.enableClasses&&(n+=" "+t+e.join(" "+t),x?_.className.baseVal=n:_.className=n)}function i(){return"function"!=typeof n.createElement?n.createElement(arguments[0]):x?n.createElementNS.call(n,"http://www.w3.org/2000/svg",arguments[0]):n.createElement.apply(n,arguments)}function a(e,n){return!!~(""+e).indexOf(n)}function l(e){return e.replace(/([a-z])-([a-z])/g,function(e,n,t){return n+t.toUpperCase()}).replace(/^-/,"")}function f(e,n){return function(){return e.apply(n,arguments)}}function u(e,n,t){var r;for(var o in e)if(e[o]in n)return t===!1?e[o]:(r=n[e[o]],s(r,"function")?f(r,t||n):r);return!1}function c(e){return e.replace(/([A-Z])/g,function(e,n){return"-"+n.toLowerCase()}).replace(/^ms-/,"-ms-")}function d(){var e=n.body;return e||(e=i(x?"svg":"body"),e.fake=!0),e}function p(e,t,s,r){var o,a,l,f,u="modernizr",c=i("div"),p=d();if(parseInt(s,10))for(;s--;)l=i("div"),l.id=r?r[s]:u+(s+1),c.appendChild(l);return o=i("style"),o.type="text/css",o.id="s"+u,(p.fake?p:c).appendChild(o),p.appendChild(c),o.styleSheet?o.styleSheet.cssText=e:o.appendChild(n.createTextNode(e)),c.id=u,p.fake&&(p.style.background="",p.style.overflow="hidden",f=_.style.overflow,_.style.overflow="hidden",_.appendChild(p)),a=t(c,e),p.fake?(p.parentNode.removeChild(p),_.style.overflow=f,_.offsetHeight):c.parentNode.removeChild(c),!!a}function m(n,s){var r=n.length;if("CSS"in e&&"supports"in e.CSS){for(;r--;)if(e.CSS.supports(c(n[r]),s))return!0;return!1}if("CSSSupportsRule"in e){for(var o=[];r--;)o.push("("+c(n[r])+":"+s+")");return o=o.join(" or "),p("@supports ("+o+") { #modernizr { position: absolute; } }",function(e){return"absolute"==getComputedStyle(e,null).position})}return t}function y(e,n,r,o){function f(){c&&(delete E.style,delete E.modElem)}if(o=s(o,"undefined")?!1:o,!s(r,"undefined")){var u=m(e,r);if(!s(u,"undefined"))return u}for(var c,d,p,y,v,h=["modernizr","tspan","samp"];!E.style&&h.length;)c=!0,E.modElem=i(h.shift()),E.style=E.modElem.style;for(p=e.length,d=0;p>d;d++)if(y=e[d],v=E.style[y],a(y,"-")&&(y=l(y)),E.style[y]!==t){if(o||s(r,"undefined"))return f(),"pfx"==n?y:!0;try{E.style[y]=r}catch(g){}if(E.style[y]!=v)return f(),"pfx"==n?y:!0}return f(),!1}function v(e,n,t,r,o){var i=e.charAt(0).toUpperCase()+e.slice(1),a=(e+" "+P.join(i+" ")+i).split(" ");return s(n,"string")||s(n,"undefined")?y(a,n,r,o):(a=(e+" "+T.join(i+" ")+i).split(" "),u(a,n,t))}function h(e,n,s){return v(e,t,t,n,s)}var g=[],C=[],w={_version:"3.3.1",_config:{classPrefix:"",enableClasses:!0,enableJSClass:!0,usePrefixes:!0},_q:[],on:function(e,n){var t=this;setTimeout(function(){n(t[e])},0)},addTest:function(e,n,t){C.push({name:e,fn:n,options:t})},addAsyncTest:function(e){C.push({name:null,fn:e})}},Modernizr=function(){};Modernizr.prototype=w,Modernizr=new Modernizr;var _=n.documentElement,x="svg"===_.nodeName.toLowerCase(),S=w._config.usePrefixes?" -webkit- -moz- -o- -ms- ".split(" "):["",""];w._prefixes=S,Modernizr.addTest("opacity",function(){var e=i("a").style;return e.cssText=S.join("opacity:.55;"),/^0.55$/.test(e.opacity)});var b="Moz O ms Webkit",P=w._config.usePrefixes?b.split(" "):[];w._cssomPrefixes=P;var T=w._config.usePrefixes?b.toLowerCase().split(" "):[];w._domPrefixes=T;var z={elem:i("modernizr")};Modernizr._q.push(function(){delete z.elem});var E={style:z.elem.style};Modernizr._q.unshift(function(){delete E.style}),w.testAllProps=v,w.testAllProps=h,Modernizr.addTest("cssanimations",h("animationName","a",!0)),Modernizr.addTest("csstransforms",function(){return-1===navigator.userAgent.indexOf("Android 2.")&&h("transform","scale(1)",!0)}),r(),o(g),delete w.addTest,delete w.addAsyncTest;for(var N=0;N<Modernizr._q.length;N++)Modernizr._q[N]();e.Modernizr=Modernizr}(window,document);

if (document.documentElement.classList.contains('opacity') && document.documentElement.classList.contains('cssanimations') && document.documentElement.classList.contains('csstransforms')) {
    document.getElementById('loadingModal').classList.add('loadingModal');
    
    window.onload = function () {
        document.getElementById('loadingModal').classList.remove('loadingModal');
        
        document.getElementById('desktopPreview').classList.add('slide-up-before');
        document.getElementById('phonePreview').classList.add('slide-up-before');
        
        document.querySelector('.navBar').classList.add('slide-down-before');
        document.querySelector('.navSideBar').classList.add('fade-in-before');
        
        document.getElementById('fullWidth-Bar').classList.add('fade-in-before');
        document.getElementById('fullWidth-Bar').classList.add('fullWidth-Bar-before');
        
        document.getElementById('load-after').classList.add('load-after-before');
        
        setTimeout(function(){
            document.getElementById('fullWidth-Bar').classList.add('fade-in-after');
            
            setTimeout(function(){
                document.getElementById('fullWidth-Bar').classList.add('fullWidth-Bar-after');

                setTimeout(function(){
                    document.getElementById('desktopPreview').classList.add('slide-up-after');

                    setTimeout(function(){
                        document.getElementById('phonePreview').classList.add('slide-up-after');

                        setTimeout(function(){
                            document.querySelector('.navBar').classList.add('slide-down-after');

                            setTimeout(function(){
                                document.querySelector('.navSideBar').classList.add('fade-in-after');
                                
                                document.getElementById('load-after').classList.add('load-after-after');
                                
                                document.getElementById('desktopPreview').classList.add('previewLoaded');
                                document.getElementById('phonePreview').classList.add('previewLoaded');
                            }, 500);
                        }, 1000);
                    }, 500);
                }, 1000);
            }, 1000);
        }, 1000);
        
        console.log("Page Loaded!");
    };
}



/*! smooth-scroll v9.1.4 | (c) 2016 Chris Ferdinandi | MIT License | http://github.com/cferdinandi/smooth-scroll */
!function(e,t){"function"==typeof define&&define.amd?define([],t(e)):"object"==typeof exports?module.exports=t(e):e.smoothScroll=t(e)}("undefined"!=typeof global?global:this.window||this.global,function(e){"use strict";var t,n,r,o,a,c={},u="querySelector"in document&&"addEventListener"in e,i={selector:"[data-scroll]",selectorHeader:"[data-scroll-header]",speed:500,easing:"easeInOutCubic",offset:0,updateURL:!0,callback:function(){}},l=function(){var e={},t=!1,n=0,r=arguments.length;"[object Boolean]"===Object.prototype.toString.call(arguments[0])&&(t=arguments[0],n++);for(var o=function(n){for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t&&"[object Object]"===Object.prototype.toString.call(n[r])?e[r]=l(!0,e[r],n[r]):e[r]=n[r])};r>n;n++){var a=arguments[n];o(a)}return e},s=function(e){return Math.max(e.scrollHeight,e.offsetHeight,e.clientHeight)},f=function(e,t){var n,r,o=t.charAt(0),a="classList"in document.documentElement;for("["===o&&(t=t.substr(1,t.length-2),n=t.split("="),n.length>1&&(r=!0,n[1]=n[1].replace(/"/g,"").replace(/'/g,"")));e&&e!==document&&1===e.nodeType;e=e.parentNode){if("."===o)if(a){if(e.classList.contains(t.substr(1)))return e}else if(new RegExp("(^|\\s)"+t.substr(1)+"(\\s|$)").test(e.className))return e;if("#"===o&&e.id===t.substr(1))return e;if("["===o&&e.hasAttribute(n[0])){if(!r)return e;if(e.getAttribute(n[0])===n[1])return e}if(e.tagName.toLowerCase()===t)return e}return null};c.escapeCharacters=function(e){"#"===e.charAt(0)&&(e=e.substr(1));for(var t,n=String(e),r=n.length,o=-1,a="",c=n.charCodeAt(0);++o<r;){if(t=n.charCodeAt(o),0===t)throw new InvalidCharacterError("Invalid character: the input contains U+0000.");a+=t>=1&&31>=t||127==t||0===o&&t>=48&&57>=t||1===o&&t>=48&&57>=t&&45===c?"\\"+t.toString(16)+" ":t>=128||45===t||95===t||t>=48&&57>=t||t>=65&&90>=t||t>=97&&122>=t?n.charAt(o):"\\"+n.charAt(o)}return"#"+a};var d=function(e,t){var n;return"easeInQuad"===e&&(n=t*t),"easeOutQuad"===e&&(n=t*(2-t)),"easeInOutQuad"===e&&(n=.5>t?2*t*t:-1+(4-2*t)*t),"easeInCubic"===e&&(n=t*t*t),"easeOutCubic"===e&&(n=--t*t*t+1),"easeInOutCubic"===e&&(n=.5>t?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1),"easeInQuart"===e&&(n=t*t*t*t),"easeOutQuart"===e&&(n=1- --t*t*t*t),"easeInOutQuart"===e&&(n=.5>t?8*t*t*t*t:1-8*--t*t*t*t),"easeInQuint"===e&&(n=t*t*t*t*t),"easeOutQuint"===e&&(n=1+--t*t*t*t*t),"easeInOutQuint"===e&&(n=.5>t?16*t*t*t*t*t:1+16*--t*t*t*t*t),n||t},m=function(e,t,n){var r=0;if(e.offsetParent)do r+=e.offsetTop,e=e.offsetParent;while(e);return r=Math.max(r-t-n,0),Math.min(r,p()-h())},h=function(){return Math.max(document.documentElement.clientHeight,window.innerHeight||0)},p=function(){return Math.max(e.document.body.scrollHeight,e.document.documentElement.scrollHeight,e.document.body.offsetHeight,e.document.documentElement.offsetHeight,e.document.body.clientHeight,e.document.documentElement.clientHeight)},g=function(e){return e&&"object"==typeof JSON&&"function"==typeof JSON.parse?JSON.parse(e):{}},b=function(t,n){e.history.pushState&&(n||"true"===n)&&"file:"!==e.location.protocol&&e.history.pushState(null,null,[e.location.protocol,"//",e.location.host,e.location.pathname,e.location.search,t].join(""))},v=function(e){return null===e?0:s(e)+e.offsetTop};c.animateScroll=function(n,c,u){var s=g(c?c.getAttribute("data-options"):null),f=l(t||i,u||{},s),h="[object Number]"===Object.prototype.toString.call(n)?!0:!1,y=h?null:"#"===n?e.document.documentElement:e.document.querySelector(n);if(h||y){var O=e.pageYOffset;r||(r=e.document.querySelector(f.selectorHeader)),o||(o=v(r));var S,I,H=h?n:m(y,o,parseInt(f.offset,10)),E=H-O,j=p(),w=0;h||b(n,f.updateURL);var C=function(t,r,o){var a=e.pageYOffset;(t==r||a==r||e.innerHeight+a>=j)&&(clearInterval(o),h||y.focus(),f.callback(n,c))},L=function(){w+=16,S=w/parseInt(f.speed,10),S=S>1?1:S,I=O+E*d(f.easing,S),e.scrollTo(0,Math.floor(I)),C(I,H,a)},A=function(){clearInterval(a),a=setInterval(L,16)};0===e.pageYOffset&&e.scrollTo(0,0),A()}};var y=function(e){if(0===e.button&&!e.metaKey&&!e.ctrlKey){var n=f(e.target,t.selector);if(n&&"a"===n.tagName.toLowerCase()){e.preventDefault();var r=c.escapeCharacters(n.hash);c.animateScroll(r,n,t)}}},O=function(e){n||(n=setTimeout(function(){n=null,o=v(r)},66))};return c.destroy=function(){t&&(e.document.removeEventListener("click",y,!1),e.removeEventListener("resize",O,!1),t=null,n=null,r=null,o=null,a=null)},c.init=function(n){u&&(c.destroy(),t=l(i,n||{}),r=e.document.querySelector(t.selectorHeader),o=v(r),e.document.addEventListener("click",y,!1),r&&e.addEventListener("resize",O,!1))},c});



// Modals
var modalCalls = document.querySelectorAll('.em-Modal-Call');
var modalCallsArray = Array.prototype.slice.call(modalCalls, 0);

var hamburgerButton = document.querySelector('a.menuCall');

modalCallsArray.forEach(function(el) {
    var modalContent = document.getElementById(el.rel).querySelector('.em-Modal-Content');
    
    if (document.getElementById(el.rel)) {
        el.onclick=function(e){
            e.preventDefault();
                        
            document.body.style.overflowY = "hidden";
            
            document.getElementById(el.rel).classList.add('em-Modal-show');
            document.getElementById(el.rel).querySelector('.em-Modal-Content').classList.add('em-Modal-Content-show');
            document.getElementById(el.rel).querySelector('.em-Modal-Close').classList.add('em-Modal-Close-show');
            
            var close = function(event) {
                if (event) {
                    event.preventDefault();
                }
                
                document.body.style.overflowY = "scroll";
                
                document.getElementById(el.rel).querySelector('.em-Modal-Close').classList.remove('em-Modal-Close-show');
                document.getElementById(el.rel).classList.remove('em-Modal-show');
                document.getElementById(el.rel).querySelector('.em-Modal-Content').classList.remove('em-Modal-Content-show');
                
                document.querySelector('header').classList.remove('blur');
                document.querySelector('.content').classList.remove('blur');
                
                hamburgerButton.classList.remove('hamburgerClicked');
            };
            
            if (el.classList.contains('menuCall')) {
                document.getElementById(el.rel).querySelector('.em-Modal-Close').style.display = "none";
                
                if (hamburgerButton.classList.contains('hamburgerClicked')) {
                    hamburgerButton.classList.remove('hamburgerClicked');
                    close();
                } else {
                    hamburgerButton.classList.add('hamburgerClicked');
                }
            }

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



// Service Boxes
var serviceBoxes = document.querySelectorAll('.serviceBox');

Array.prototype.slice.call(serviceBoxes, 0).forEach(function(el) {
    el.onmouseover = function(e) {
        if (!el.classList.contains('defaultService')) {
            Array.prototype.slice.call(serviceBoxes, 0).forEach(function(ell) {
                if (ell.classList.contains('defaultService')) {
                    ell.classList.remove('defaultService');
                }
            });
            el.classList.add('defaultService');
        }
    }
});