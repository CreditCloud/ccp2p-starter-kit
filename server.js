'use strict';
var http = require('http');
var path = require('path');
var fs = require('fs');
var less = require('less');
var errto = require('errto');
var serveStatic = require('serve-static');
var trumpet = require('trumpet');
var finalhandler = require('finalhandler');

var serve = serveStatic(__dirname, {
    etag: false,
    index: false,
    setHeaders: setHeaders
});

function setHeaders(res, filePath) {
    console.log(filePath);
    if (filePath.match(/\.(md|mkd|markdown|less)$/i)) {
        console.log(1);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
}

function logerror(err) {
    console.error(err.stack || err.toString());
}

var server = http.createServer(function (req, res) {
    var done = finalhandler(req, res, {
        onerror: logerror
    });
    serve(req, res, errto(done, tryLess));

    function tryLess() {
        var filePath;
        if (!req.url.match(/\.css($|\?)/i)) return tryHtml();
        var fileName = req.url.replace(/\.css(\?.*)?$/i, '.less');
        filePath = path.join(__dirname, fileName);
        fs.exists(filePath, function (exists) {
            console.log(filePath, exists);
            if (!exists) return done();
            fs.readFile(filePath, 'utf-8', errto(done, gotLessContent));
        });

        function gotLessContent(content) {
            less.render(content, {
                filename: filePath,
                relativeUrls: true,
                paths: [path.dirname(filePath)],
                sourceMap: {
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                    sourceMapInputFilename: path.basename(fileName),
                    sourceMapBasepath: __dirname,
                    sourceMapRootpath: '/'
                }
            }, errto(done, function (output) {
                res.writeHead(200, {
                    'Content-Type': 'text/css; charset=utf-8'
                });
                res.end(output.css);
            }));
        }
    }

    function tryHtml() {
        var filePath = path.join(__dirname, req.url.replace(/\.html\?.*$/i, ''));
        console.log(filePath);
        console.log(path.join(filePath, 'index.html'));
        fse(filePath + '.html', gotExisted,
            fse.bind(null, path.join(filePath, '/index.html'), gotExisted, done));
    }

    function fse(filePath, efn, nefn) {
        fs.exists(filePath, function (exists) {
            console.log(filePath, exists);
            if (exists) efn(filePath);
            else nefn();
        });
    }

    function gotExisted(filePath) {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8'
        });
        fse(path.join(__dirname, 'layout.html'), function (layoutFilePath) {
            var tr = trumpet();
            fs.createReadStream(layoutFilePath).pipe(tr);
            fs.createReadStream(filePath).pipe(
                tr.select('div#main-container').createWriteStream());
            tr.pipe(res);
        }, function () {
            fs.createReadStream(filePath).pipe(res);
        })
    }
});

server.listen(4000, '0.0.0.0', function () {
    console.log('请访问 http://localhost:4000/');
});
