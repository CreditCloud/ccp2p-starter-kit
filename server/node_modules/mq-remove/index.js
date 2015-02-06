'use strict';
var css = require("css");
var mediaQuery = require("css-mediaquery");

module.exports = mqRemove;

function mqFlatten(rules, rule) {
    var nextRules = rules;

    if (!rule.media) {
        nextRules = rule.rules = [];
        rules.push(rule);
    }

    if (rule.rules) {
        rule.rules.reduce(mqFlatten, nextRules);
    }

    return rules;
}

function mqRemove(contents, query) {
    var data = css.parse(contents);

    var filterRule = function (rule) {
        if (rule.type === "media" && !mediaQuery.match(rule.media, query)) {
            return false;
        }

        // Recurse
        if (rule.rules) {
            rule.rules = rule.rules.filter(filterRule);
        }

        return true;
    };

    if (data.stylesheet) {
        filterRule(data.stylesheet);
        if (data.stylesheet.rules) {
            data.stylesheet.rules = data.stylesheet.rules.reduce(mqFlatten, []);
        }
    }

    return css.stringify(data);
}
