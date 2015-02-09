var vm = require('vm'),

    vow = require('vow'),
    sha = require('sha1'),
    html = require('js-beautify').html,
    mime = require('mime'),
    MDS = require('mds-wrapper');

modules.define('middleware__proxy-example', ['config', 'constants', 'logger', 'util', 'model'],
    function (provide, config, constants, logger, util, model) {
        logger = logger(module);

        var mds = new MDS(config.get('mds'));

        /**
         * Loads sources for url and sent them to response
         * @param {String} url of request
         * @param {String} ref - value of reference (branch or tag)
         * @param  {Object} req - response object
         * @param  {Object} res - response object
         * @returns {*}
         */
        var proxyTextFiles = function (url, ref, req, res) {
            var originUrl = url;

            // set the content-types by mime type
            // fix firefox charsets for bemjson files
            res.type(mime.lookup(url));
            if (/\.bemjson\.js$/.test(url)) {
                res.header('Content-Type', 'application/json; charset=utf-8');
            }

            model.getFromCache(sha(url))
                .then(function (response) {
                    if (response) {
                        return res.end(response);
                    }
                    logger.debug('request to url: %s', url);
                    return mds.readP(url)
                        .then(function (response) {
                            if (/\.bemhtml\.js$/.test(url)) {
                                return loadCode(req, originUrl, response).then(function (html) {
                                    model.putToCache(sha(url), html);
                                    res.end(html);
                                });
                            } else {
                                model.putToCache(sha(url), response);
                                return res.end(response);
                            }
                        })
                        .fail(function (error) {
                            logger.warn('req to %s failed with err %s', url, error);
                            return res.end('Error while loading example');
                        });
                })
                .done();
        };

        /**
         * Proxy image files from gh
         * @param {String} url
         * @param {Object} res - response object
         */
        function proxyImageFiles(url, res) {
            res.type(mime.lookup(url));
            mds.read(url, function (error, result) {
                res.end(error ? '' : result);
            });
        }

        provide(function () {
            var PATTERN = {
                    EXAMPLE: '/__example/',
                    FREEZE: '/output/'
                },
                VERSION_REGEXP = /\/v?\d+\.\d+\.\d+\//;

            return function (req, res, next) {
                var url = req.path;

                if (url.indexOf(PATTERN.EXAMPLE) > -1) {
                    return proxyTextFiles(url.replace(PATTERN.EXAMPLE, ''),
                        VERSION_REGEXP.test(url) ? constants.DIRS.TAG : constants.DIRS.BRANCH, req, res);
                }
                if (url.indexOf(PATTERN.FREEZE) > -1) {
                    return proxyImageFiles(url.replace(PATTERN.FREEZE, ''), res);
                }
                return next();
            };
        });

        function loadCode(req, url, template) {
            var urlRegExp = /^\/(.+)\/(.+)\/(.+)\/(.+)\/(.+)\/(.+)\.bemhtml\.js$/,
                match = url.match(urlRegExp);

            if (!match) { return null; }

            return model
                .getNodesByCriteria(function (record) {
                    var v = record.value,
                        r = v.route,
                        c = r.conditions;
                    return v.class === 'block' && r && c &&
                        match[1] === c.lib &&
                        match[2] === c.version &&
                        match[3].replace(/\.examples$/, '') === c.level &&
                        match[4] === c.block;
                }, true)
                .then(function (node) {
                    if (!node) { return vow.resolve(null); }
                    return model.getBlock(node.value.source.data);
                })
                .then(function (blockData) {
                    var example, htmlStr;
                    if (!blockData) { return vow.resolve(null); }
                    example = blockData[req.lang].examples.filter(function (item) {
                        return item.name && match[5] === item.name;
                    })[0];

                    if (!example) { return null; }

                    var bemhtml = {},
                        bemjson = vm.runInNewContext('(' + example.source + ')', {});

                    vm.runInNewContext(template, bemhtml);
                    htmlStr = bemhtml.BEMHTML.apply(bemjson);

                    // return html.prettyPrint(htmlStr);
                    return html(htmlStr, { 'indent_size': 4 });
                });
        }
});
