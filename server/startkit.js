#!/usr/bin/env node

'use strict';
var http = require('http');
var path = require('path');
var fs = require('fs');
var less = require('less');
var errto = require('errto');
var serveStatic = require('serve-static');
var trumpet = require('trumpet');
var finalhandler = require('finalhandler');
var useragent = require('useragent');
var mqRemove = require('mq-remove');

var workRoot = process.cwd();
var port = Number(process.argv[2]) || 4000;
var cache = {};

function rmq(content) {
    var result = '';
    try {
        result = mqRemove(content, {
            type: 'screen',
            width: '1024px'
        });
    } catch (err) {
        var errStr = err.stack || err.toString();
        console.error(errStr);
        result = '/* 出错了：\n' + errStr + '\n*/';
    }
    return result;
}

var serve = serveStatic(workRoot, {
    etag: false,
    index: false,
    setHeaders: setHeaders
});

function setHeaders(res, filePath) {
    res.log.filePath = filePath;
    if (filePath.match(/\.(md|mkd|markdown|less)$/i)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
}

function logerror(err) {
    console.error(err.stack || err.toString());
}

function logres(logInfo) {
    var args = [logInfo.url];
    if (logInfo.filePath) {
        args.push('<==', logInfo.filePath.substring(workRoot.length));
    } else {
        args.push('--> 404 not found');
        console.log.apply(console, args);
        return;
    }
    if (logInfo.fromCache) args.push('-- from cache');
    if (logInfo.noMediaQueries) args.push('-- mediaqueries removed');
    if (logInfo.withLayout) args.push('-- with layout');
    console.log.apply(console, args);
}

function normalizeUrl(req) {
    if (req.url.match(/[?&]nolayout(&|$|=)/)) {
        req.noLayout = true;
    }
    req.url = req.url.replace(/\/+/g, '/').replace(/\?.*$/, '');
}

function fse(filePath, efn, nefn) {
    fs.exists(filePath, function (exists) {
        if (exists) efn(filePath);
        else nefn();
    });
}

var server = http.createServer(function (req, res) {
    res.req = req;
    normalizeUrl(req);
    var done = finalhandler(req, res, {
        onerror: logerror
    });
    res.log = {
        url: req.url
    };
    res.on('finish', function () {
        logres(res.log);
    })

    if (req.url.indexOf('/favicon.ico') === 0) {
        req.url = '/assets/favicon.ico';
        return tryStatic();
    }
    if (req.url.indexOf('/assets/') === 0) {
        if (!req.url.match(/\.css$/i)) return tryStatic();
        return tryLess();
    }
    return tryHtml();

    function tryLess() {
        var filePath;
        var isBaseCss = req.url.indexOf('/assets/css/base.css') === 0;
        filePath = path.join(workRoot, req.url.replace(/\.css$/i, '.less'));
        fse(filePath, function (filePath) {
            res.log.filePath = filePath;
            if (isBaseCss && cache.base) {
                res.log.fromCache = true;
                return respondCss(cache.base);
            }
            fs.readFile(filePath, 'utf-8', errto(done, gotLessContent));
        }, tryCss);

        function gotLessContent(content) {
            less.render(content, {
                filename: filePath,
                relativeUrls: true,
                paths: [path.dirname(filePath)],
                sourceMap: {
                    sourceMapFileInline: true,
                    outputSourceFiles: true,
                    sourceMapInputFilename: path.basename(filePath),
                    sourceMapBasepath: workRoot,
                    sourceMapRootpath: '/'
                }
            }, errto(done, function (output) {
                if (isBaseCss) {
                    cache.base = output.css;
                }
                respondCss(output.css);
            }));
        }
    }

    function tryCss() {
        var filePath = path.join(workRoot, req.url);
        fse(filePath, function (filePath) {
            res.log.filePath = filePath;
            fs.readFile(filePath, 'utf-8', errto(done, respondCss));
        }, tryStatic);
    }

    function respondCss(content, fileName) {
        var ua = useragent.parse(req.headers['user-agent']);
        if (ua.family === 'IE' && ua.major < 9) {
            res.log.noMediaQueries = true
            content = rmq(content);
        }
        res.writeHead(200, {
            'Content-Type': 'text/css; charset=utf-8'
        });
        res.end(content);
    }

    function tryStatic() {
        serve(req, res, errto(done, done));
    }

    function tryHtml() {
        var filePath = path.join(workRoot, req.url.replace(/\.html$/i, ''));
        fse(filePath + '.html', gotHtmlPath,
            fse.bind(null, path.join(filePath, '/index.html'), gotHtmlPath,
                done));

        function gotHtmlPath(filePath) {
            res.log.filePath = filePath;
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            if (req.noLayout) return responseNoLayout();
            fse(path.join(workRoot, '_layout.html'), function (
                layoutFilePath) {
                res.log.withLayout = true;
                var tr = trumpet();
                fs.createReadStream(layoutFilePath).pipe(tr);
                fs.createReadStream(filePath).pipe(
                    tr.select('div#main-container').createWriteStream()
                );
                tr.pipe(res);
            }, responseNoLayout);

            function responseNoLayout() {
                fs.createReadStream(filePath).pipe(res);
            }
        }
    }
});

server.on('error', function (err) {
    console.error(err.stack || err.toString());
    if (err.code === 'EADDRINUSE') {
        console.error('错误：' + port + ' 端口已被占用，请先退出之前已启动的服务器。');
    } else {
        console.error('发生未知错误');
    }
});

server.listen(port, '0.0.0.0', function () {
    console.log('请访问 http://localhost:' + port + '/');
});
