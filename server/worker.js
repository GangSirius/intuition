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


//NOTE Use of the cluster plugin
//NOTE colors, socket.io, jade, stylus, express, websocket
//FIXME Errors and neither elegant nor generic

var log = require('logging');

/*
 *Process forker, using backend forwarder socket
 */
function run(parameters, backSocket, frontSocket, channel)
{
    // Creating command line args from the 'args' field in json config
    var script_args = [];
        
    if ('args' in parameters) {
        for (var arg in parameters.args) {
            if (parameters.args[arg].prefix != 'flag') {
                script_args.push(parameters.args[arg].prefix);
            }
            script_args.push(parameters.args[arg].value);
        };
    }

    // Spawning script (path relative to project's root directory)
    var script = require('path').join(process.env.QTRADE, parameters.script);
    var spawn = require('child_process').spawn,
        child = spawn(script, script_args);
    log(script_args)

    child.stdout.on('data', function (data) {
        //NOTE verbose condition ?
        //console.log('[Node:worker:stdout] ' + data);
    });

    child.stderr.on('data', function (data) {
        //console.log('[Node:worker:stderr] ' + data);
    });

    child.on('exit', function (code, signal) {
        if (code === 0) {
            log('[Node:worker] Child exited normaly (' + code + ')')
        } else {
            log('[Node:worker] Child process terminated with code ' + code + ', signal: ' + signal);
        }
        child.stdin.end();
        child = undefined;
        frontSocket.send([channel, JSON.stringify({'time': new Date(), 'type': 'acknowledgment', 'msg': code})]);
    });

    log(process.pid + ' - ' + process.title + ': Spawned child pid: ' + child.pid);
    log('[Node:worker] Running worker: ' + script)
    require('sleep').sleep(5);
        
    if ('configuration' in parameters) {
        log('[Node:worker] Sending configuration to worker...');
        backSocket.send(JSON.stringify(parameters.configuration))
        //backSocket.send(JSON.stringify({algorithm: parameters.algorithm, manager: parameters.manager, done:true}))
    }
    else {
        log('[Node:worker] No remote configuration to send');
    }

    process.on("SIGTERM", function() {
        log("[Node:worker] Parent SIGTERM detected");
        backSocket.close();
        process.exit();
    });

    process.on("SIGINT", function() {
        log("[Node:worker] Signal SIGINT detected");
        backSocket.close();
        process.exit();
    });

    process.on("exit", function() {
        if (child != undefined) {
            log("[Node:worker] Killing child");
            child.kill('SIGHUP');
        }
        frontSocket.send([channel, JSON.stringify({'time': new Date(), 'type': 'on_exit', 'msg': 1})]);
    });

    process.on('uncaughtException', function (err) {
        error('[Node:worker] An uncaught error occurred!');
        backSocket.close();
        error(err.stack);
    });
}

/*
 *Process forker, using http socket
 *Merge or delete later
 */
function run_standalone(config_txt, socket)
{
    var zmq_client = require('zmq').socket('req');
    var config = JSON.parse(config_txt);

    var script_args = []
    for (var arg in config.args) {
        script_args.push(config.args[arg].prefix);
        if (config.args[arg].prefix != '--interactive' && config.args[arg].prefix != '--realtime')
            script_args.push(config.args[arg].value);
    };

    var script = require('path').join(process.env.QTRADE, config.script);
    var spawn = require('child_process').spawn,
        child = spawn(script, script_args);
    console.log(script_args)

    child.stdout.on('data', function (data) {
        console.log('[Node:worker:stdout] ' + data);
    });

    child.stderr.on('data', function (data) {
        console.log('[Node:worker:stderr] ' + data);
    });

    child.on('exit', function (code, signal) {
        if (code === 0) {
            console.log('[Node:worker] Child exited normaly (' + code + ')')
        } else {
            console.log('[Node:worker] Child process terminated with code ' + code + ', signal: ' + signal);
        }
        child.stdin.end()
        child = undefined
        socket.write('done:' + code)
    });

    console.log(process.pid + ' - ' + process.title + ': Spawned child pid: ' + child.pid);
    console.log('[Node:worker] Running worker: ' + script)
        
    //child.stdin.write(JSON.stringify(config.algo) + '\n')
    //child.stdin.write(JSON.stringify(config.manager) + '\n')

    zmq_client.on('message', function(reply) {
        reply_str = reply.toString()
        data = JSON.parse(reply)
        console.log('Server replied: ', data)
        console.log('date', data.date)
        if (reply_str.search('portfolio') > 0)
        {
            console.log('Portfolio value:', data.portfolio['value'])
        }
        else if (reply_str.search('statut') > 0)
        {
            console.log('Server acknowledgment:', data.statut)
        }
        zmq_client.send(JSON.stringify({statut: 'ok'}))
    })

    console.log('Connecting to tcp://localhost:' + config.port);
    zmq_client.connect('tcp://localhost:' + config.port);
    console.log('Connected.')

    console.log('Sending configuration...');
    zmq_client.send(JSON.stringify({algorithm: config.algorithm, manager: config.manager, done:true}))

    process.on("SIGTERM", function() {
        console.log("[Node:worker] Parent SIGTERM detected");
        zmq_client.close();
        process.exit();
    });

    process.on("SIGINT", function() {
        console.log("[Node:worker] Signal SIGINT detected");
        zmq_client.close();
        process.exit();
    });

    process.on("exit", function() {
        if (child != undefined) {
            console.log("[Node:worker] Killing child");
            child.kill('SIGHUP');
        }
    });

    process.on('uncaughtException', function (err) {
        console.error('[Node:worker] An uncaught error occurred!');
        zmq_client.close();
        console.error(err.stack);
    });
}

exports.run = run;
exports.run_standalone = run_standalone;
