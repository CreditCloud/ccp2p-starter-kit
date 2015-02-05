'use strict';
var http = require('http');
var path = require('path');
var fs = require('fs');
var less = require('less');
var errto = require('errto');
var serveStatic = require('serve-static');
var trumpet = require('trumpet');
var finalhandler = require('finalhandler');

var workRoot = path.join(__dirname, '..', 'work');

var serve = serveStatic(workRoot, {
    etag: false,
    index: false,
    setHeaders: setHeaders
});

function setHeaders(res, filePath) {
    log(res.req.url, filePath);
    if (filePath.match(/\.(md|mkd|markdown|less)$/i)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
}

function logerror(err) {
    console.error(err.stack || err.toString());
}

function log(url, filePath) {
    console.log(url, '<==', filePath.substring(workRoot.length));
}

function normalize(p) {
    return p.replace(/\/+/g, '/');
}

function fse(filePath, efn, nefn) {
    fs.exists(filePath, function (exists) {
        if (exists) efn(filePath);
        else nefn();
    });
}

var server = http.createServer(function (req, res) {
    res.req = req;
    req.url = normalize(req.url);
    var done = finalhandler(req, res, {
        onerror: logerror
    });
    
    if (req.url.indexOf('/assets/') === 0) return tryLess();
    else return tryHtml();

    function tryLess() {
        var filePath;
        if (!req.url.match(/\.css($|\?)/i)) return tryStatic();
        var fileName = req.url.replace(/\.css(\?.*)?$/i, '.less');
        filePath = path.join(workRoot, fileName);
        fse(filePath, function (filePath) {
            log(req.url, filePath);
            fs.readFile(filePath, 'utf-8', errto(done, gotLessContent));
        }, tryStatic);

        function gotLessContent(content) {
            less.render(content, {
                filename: filePath,
                relativeUrls: true,
                paths: [path.dirname(filePath)],
                sourceMap: {
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                    sourceMapInputFilename: path.basename(fileName),
                    sourceMapBasepath: workRoot,
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
    
    function tryStatic() {
        serve(req, res, errto(done, tryHtml));
    }

    function tryHtml() {
        var filePath = path.join(workRoot, req.url.replace(/\.html\?.*$/i, ''));
        fse(filePath + '.html', gotHtmlPath,
            fse.bind(null, path.join(filePath, '/index.html'), gotHtmlPath, done));

        function gotHtmlPath(filePath) {
            log(req.url, filePath);
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            fse(path.join(workRoot, '_layout.html'), function (layoutFilePath) {
                var tr = trumpet();
                fs.createReadStream(layoutFilePath).pipe(tr);
                fs.createReadStream(filePath).pipe(
                    tr.select('div#main-container').createWriteStream());
                tr.pipe(res);
            }, function () {
                fs.createReadStream(filePath).pipe(res);
            })
        }
    }
});

server.listen(4000, '0.0.0.0', function () {
    console.log('请访问 http://localhost:4000/');
});
