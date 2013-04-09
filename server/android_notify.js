//
// Copyright 2012 Xavier Bruhiere
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 *NotifyMyAndroid node.js wrapper
 *Send a notification command to your device:
 *  notifyMA(apikey, "News Crow", "Winter is Coming!", "It's been -4C degrees here, so Winter is coming for sure!", 4 );
 *Check your key validity:
 *  checkMAKey(apikey);
 */
 
var xml     = require('xml2js');
var request = require('request');
var log     = require('logging');
var nma_config  = require('config').notifymyandroid;

// The apikey provided by NotifyMyAndroid connects their servers with the device
//exports.apikey = process.env.QTRADE_NMA_KEY;
exports.apikey = nma_config.apikey

/*
 *@summary   Send notification to the android device attached to the api key
 *@parameter Self-described i guess, see http://www.notifymyandroid.com/api.jsp for details
 */
exports.notify = function(keystring, appname, eventtitle, descriptiontext, priorityvalue) {
    //NOTE you can also use (http|https).request but this was easier for me
    //Post the notification with a check callback
    //var r = request.post('http://www.notifymyandroid.com/publicapi/notify', 
    var r = request.post(nma_config.url_notify, 
                    {form : 
                        {apikey: keystring,
                         application: appname,
                         event: eventtitle,
                         description: descriptiontext,
                         priority: priorityvalue}}, 

                     function (error, response, body) {
                        if (!error) {
                            if (response.statusCode == 200) {
                                //Everything went fine
                                //Server speaks xml
                                var parser = new xml.Parser()
                                parser.parseString(body.toString(), function(err, result){
                                    var success = result.nma.success[0].$;
                                    // you can use these to manage your notification cases
                                    log("Notifications has been sent successfully: " + success.code);
                                    log("\tNotifications remaining for this hour: " + success.remaining);
                                    log("\tMinutes before hour timer reset: " + success.resettimer);
                                });
                            }
                            else {
                                //Aie...
                                var parser = new xml.Parser()
                                parser.parseString(body.toString(), function(err, result) {
                                    var error = result.nma.error[0].$;
                                    log(error.code + ': Invalid key - ' + keystring);
                                    log(error._)
                                    if (error.code == 402) {
                                        //Supplement parameter for this error code
                                        log(error.timeleft + ' minutes left before hour limit reset')
                                    }
                                })
                            }
                        }
                        else {
                            log('** Error in get request')
                        }
    });
}

/*
 *@summary   Check api key validity and describe issues
 *@parameter Api key obviously...
 */
exports.check_key = function(keystring) {
    //check_url = 'https://www.notifymyandroid.com/publicapi/verify';
    //var r_code = request.get(check_url, {qs: {apikey: keystring}}, function(error, response, body) {
    var r_code = request.get(nma_config.url_check, {qs: {apikey: keystring}}, function(error, response, body) {
        if (!error) {
            if (response.statusCode == 200) {
                var parser = new xml.Parser()
                parser.parseString(body.toString(), function(err, result) {
                    var success = result.nma.success[0].$;
                    log('The apikey supplied is valid - ' + keystring);
                    log("\tRemaining  : " + success.remaining);
                    log("\tResettimer : " + success.resettimer);
                })
            }
            else {
                var parser = new xml.Parser()
                parser.parseString(body.toString(), function(err, result) {
                    var error = result.nma.error[0].$;
                    log(error.code + ': Invalid key - ' + keystring);
                    log(error._)
                    if (error.code == 402) {
                        log(error.timeleft + ' minutes left before hour limit reset')
                    }
                })
            }
        } 
        else {
            log('** Error sending notification.')
        }
    })
}
