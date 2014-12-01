var u = require('util'),
    vm = require('vm'),
    zlib = require('zlib'),
    https = require('https'),

    vow = require('vow'),
    request = require('request'),
    sha = require('sha1'),
    html = require('js-beautify').html,
    mime = require('mime');

modules.define('middleware__proxy-example', ['config', 'constants', 'logger', 'util', 'model'],
    function (provide, config, constants, logger, util, model) {
        logger = logger(module);

        var libRepo = config.get('github:libraries');

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
            res.type(mime.lookup(url));
            url = u.format(libRepo.pattern, libRepo.user, libRepo.repo, libRepo.ref, url);

            /**
             * Retrieve gzipped files via request
             * @param {String} url - request url
             * @param {Function} callback - callback function
             */
            function getGzipped(url, callback) {
                var buffer = [],
                    gunzip = zlib.createGunzip(),
                    resultStream;

                https.get(url, function (response) {
                    resultStream = response;

                    if (response.headers['content-encoding'] === 'gzip') {
                        response.pipe(gunzip);
                        resultStream = gunzip;
                    }

                    resultStream.on('data', function (data) {
                        buffer.push(data.toString());
                    }).on('end', function() {
                        callback(null, buffer.join(''));
                    }).on('error', function (err) {
                        callback(err);
                    });
                }).on('error', function (err) {
                    callback(err);
                });
            }

            /**
             * Error callback function
             * @param {Error} error - error object
             */
            function onError (error) {
                if (error) {
                    logger.warn('req to %s failed with err %s', url, error);
                    res.end('Error while loading example');
                }
            }

            /**
             * Success callback function
             * @param {Object} response - response object
             */
            function onSuccess (response) {
                if (/\.bemhtml\.js$/.test(url)) {
                    response = loadCode(req, originUrl, response);
                }
                model.putToCache(sha(url), response);
                res.end(response);
            }

            function sendRequest () {
                logger.debug('request to url: %s', url);

                getGzipped(url, function (error, response) {
                    onError(error);
                    onSuccess(response);
                });
            }

            /*
             try to load cached source from local filesystem
             try to load source from github repository if no cached file was found
             */
            return model.getFromCache(sha(url)).then(function (response) {
                return response ? res.end(response) : sendRequest();
            });
        };

        provide(function () {
            var PATTERN = {
                    EXAMPLE: '/__example',
                    FREEZE: '/output'
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

        /**
         * Proxy image files from gh
         * @param {String} url
         * @param {Object} res - response object
         */
        function proxyImageFiles(url, res) {
            res.type(mime.lookup(url));
            request.get(u.format(libRepo.pattern, libRepo.user, libRepo.repo, libRepo.ref, url)).pipe(res);
        }

        function loadCode(req, url, template) {
            var urlRegExp = /^\/(.+)\/(.+)\/(.+)\/(.+)\/(.+)\/(.+)\.bemhtml\.js$/,
                match = url.match(urlRegExp);

            if (!match) { return null; }

            return model
                .getNodesByCriteria(function (record) {
                    var k = record.key,
                        v = record.value,
                        r = v.route;
                    return k.indexOf(':nodes') > -1 && v.class === 'block' && r && r.conditions &&
                        match[1] === r.conditions.lib &&
                        match[2] === r.conditions.version &&
                        match[3].replace(/\.examples$/, '') === r.conditions.level &&
                        match[4] === r.conditions.block;
                }, true)
                .then(function (node) {
                    if (!node) { return vow.resolve(null); }
                    return model.getBlocks()[node.source.key];
                })
                .then(function (blockData) {
                    var example, htmlStr;
                    if (!blockData) { return vow.resolve(null); }
                    example = blockData.data[req.lang].examples.filter(function (item) {
                        return item.name && match[5] === item.name;
                    })[0];

                    if (!example) { return null; }

                    var bemhtml = {},
                        bemjson = vm.runInNewContext('(' + example.source + ')', {});

                    vm.runInNewContext(template, bemhtml);
                    htmlStr = bemhtml.BEMHTML.apply(bemjson);

                    // return html.prettyPrint(htmlStr);
                    return html(htmlStr, { indent_size: 4 });
                });
        }
});
