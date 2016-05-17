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

$(document).ready(function(){

  $('.selection-box').click(function() {
    $('.selection-box').removeClass('active');
    $(this).addClass('active');
    //Change the content from the selection box
    $('.instruction-box').addClass('hidden');
    $('.instruction-box[name=instruction-' + $(this).attr('name') + ']').removeClass('hidden');
    
    $("video").each(function(i, e) {e.pause();});
  });
});

// Setup the ajax indicator
$('body').append('<div id="ajaxBusy"><p><img src="images/loading.gif"></p></div>');

$('#ajaxBusy').css({
  display:"none",
  margin:"0px",
  paddingLeft:"0px",
  paddingRight:"0px",
  paddingTop:"0px",
  paddingBottom:"0px",
  position:"fixed",
  left:"50%",
  top:"50%",
  width:"auto"
});

// Ajax activity indicator bound to ajax start/stop document events
$(document).ajaxStart(function(){
  $('#ajaxBusy').show();
}).ajaxStop(function(){
  $('#ajaxBusy').hide();
});

//Scroll page control
$('.ibm-top-link').click(function() {
		$('html, body').animate({scrollTop : 0},400);
		return false;
});

$(window).scroll(function (event) {
    var scroll = $(window).scrollTop();
    var topLink = $('.ibm-top-link');
    if (scroll > 0){
      if(topLink.hasClass('hidden')){
        topLink.removeClass('hidden');
      }
    }
    else {
      if(!topLink.hasClass('hidden')){
        topLink.addClass('hidden');
      }
    }
});