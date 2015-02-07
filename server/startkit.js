'use strict';
var http = require('http');
var path = require('path');
var fs = require('fs');
var co = require('co');
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

function exists(filePath) {
    return new Promise(function (resolve) {
        fs.exists(filePath, resolve);
    });
}

function firstExists(filePaths) {
    return co.wrap(function * (filePaths) {
        var filePath;
        while ((filePath = filePaths.shift())) {
            if (yield exists(filePath)) return filePath;
        }
        return false;
    })((Array.isArray(filePaths) ?
            filePaths : Array.prototype.slice.call(arguments))
        .filter(function (
            filePath) {
            return filePath && typeof filePath === 'string';
        }));
}

function readFile(filePath) {
    return co(function * () {
        return yield fs.readFile.bind(fs, filePath, 'utf-8');
    });
}

function renderLess(filePath) {
    return co(function * () {
        var content = yield readFile(filePath);
        var output = yield less.render.bind(less, content, {
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
        });
        return output.css;
    });
}

var server = http.createServer(function (req, res) {
    normalizeUrl(req);
    res.log = {
        url: req.url
    };
    res.on('finish', function () {
        logres(res.log);
    })
    var done = finalhandler(req, res, {
        onerror: logerror
    });
    co(route).then(done.bind(null, null)).catch(done);

    function * route() {
        if (req.url.indexOf('/favicon.ico') === 0) {
            req.url = '/assets/favicon.ico';
            return co(tryStatic)
        }
        if (req.url.indexOf('/assets/') === 0) {
            if (!req.url.match(/\.css$/i)) return co(tryStatic);
            return co(tryLessAndCss);
        }
        return co(tryHtml);
    }

    function * tryLessAndCss() {
        var isBaseCss = req.url.indexOf('/assets/css/base.css') === 0;
        var filePaths = [
            path.join(workRoot, req.url.replace(/\.css$/i, '.less')),
            path.join(workRoot, req.url)
        ];
        if (isBaseCss && cache.base) {
            res.log.fromCache = true;
            res.log.filePath = filePaths[0];
            return respondCss(cache.base);
        }
        var filePath = yield firstExists(filePaths);
        if (!filePath) return co(tryStatic);
        res.log.filePath = filePath;
        var content;
        if (filePath.match(/\.less$/i)) {
            content = yield renderLess(filePath);
            if (isBaseCss) cache.base = content;
        } else {
            content = yield readFile(filePath);
        }
        return respondCss(content);
    }

    function respondCss(content) {
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

    function * tryStatic() {
        yield serve.bind(null, req, res);
    }

    function * tryHtml() {
        var basePath = path.join(workRoot, req.url.replace(/\.html$/i, ''));
        var filePath = yield firstExists([
            basePath + '.html',
            path.join(basePath, '/index.html')
        ]);
        if (!filePath) return;

        res.log.filePath = filePath;
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8'
        });
        var layoutFilePath = path.join(workRoot, '_layout.html');
        if (req.noLayout || !(yield exists(layoutFilePath))) {
            fs.createReadStream(filePath).pipe(res);
            return;
        }
        res.log.withLayout = true;
        var tr = trumpet();
        fs.createReadStream(layoutFilePath).pipe(tr);
        fs.createReadStream(filePath).pipe(
            tr.select('div#main-container').createWriteStream()
        );
        tr.pipe(res);
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
