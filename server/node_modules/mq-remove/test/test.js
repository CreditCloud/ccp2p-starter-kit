var tape = require("tape");
var fs = require('fs');
var path = require('path');

var mqRemove = require("../index");

tape("mq-remove should remove media queries", function (test) {
    test.plan(1);
    var style = fs.readFileSync(path.join(__dirname, "style.css"), 'utf-8');
    var result = fs.readFileSync(path.join(__dirname, "results.css"), 'utf-8');

    test.strictEqual(result, mqRemove(style, {
        width: "1024px"
    }));
});
