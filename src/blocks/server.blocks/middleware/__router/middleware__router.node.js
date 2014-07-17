var _ = require('lodash'),
    Susanin = require('susanin');

modules.define('middleware__router', ['config', 'logger', 'constants', 'model', 'appError'], function(provide, config, logger, constants, model, error) {

    logger = logger(module);

    var router = null;

    provide({

        init: function() {
            router = model.getRoutes().reduce(function(prev, item) {
                prev.addRoute(item);
                return prev
            }, new Susanin());
        },

        run: function() {
            this.init();

            var self = this;

            return function(req, res, next) {
                var url = decodeURIComponent(req.path);

                if(_.isFunction(self.beforeRoute)) {
                    url = self.beforeRoute.call(self, url);
                }

                var route = router.findFirst(url);

                if(route) {
                    req.route = route[0].getName();
                    req.params = route[1];
                }
                req.__data = req.__data || {};

                logger.debug('get node by request %s', req.path);

                if(_.isFunction(self.beforeFindNode)) {
                    url = self.beforeFindNode.call(self, req, res, url);
                }

                return self.findNode(req, url, function(result) {
                    if(_.isFunction(self.afterFindNode) && self.afterFindNode.call(self, result, req, res)) {
                        return;
                    }

                    req.__data.node = result;
                    return next();
                });
            };
        },

        /**
         * Find node from model by url comparison
         * @param req - {Object} request object
         * @param url - {String} url string
         * @param callback - {Function} function that should be called for result
         * @returns {*}
         */
        findNode: function(req, url, callback) {

            var result = null;

            /**
             * Recursive method for finding node by it url
             * @param node - {Object} model node
             * @param url - {String} url
             * @returns {Object} node
             */
            var traverseTreeNodes = function(node, url) {
                //console.log('url %s nodeUrl %s', url, node.url);
                if(node.url === url) {
                    if(node.hidden[req.lang]) {
                        throw error.HttpError.createError(404);
                    }
                    result = node;
                    return result;
                }

                //deep into node items
                if(!result && node.items) {
                    node.items.some(function(item) {
                        return traverseTreeNodes(item, url);
                    });
                }
            };

            model.getSitemap().some(function(item) {
                return traverseTreeNodes(item, url);
            });

            if(result) {
                logger.debug('find node %s %s', result.id, result.source);
                return callback ? callback.call(null, result) : result;
            }else {
                logger.error('cannot find node by url %s', url);
                throw error.HttpError.createError(404);
            }
        },

        beforeRoute: function(url) {
            url = url.replace(/\.(sets|docs)/, '');
            return url;
        },

        /**
         * Callback function before find node
         * @param req - {Object} request object
         * @param url - {String} request url
         * @returns {String} processed url
         */
        beforeFindNode: function(req, res, url) {
            //Remove tab parts of url before processing it
            url = url.replace(/(\/docs\/)|(\/jsdoc\/)|(\/examples\/)?/gi, '');

            //Remove trailing slash for url
            url = url !== '/' ? url.replace(/(\/)+$/, '') : url;

            //Detect /current/ part in url and replace it by actual library version
            if(/\/current\/?/.test(url)) {
                var libUrl = url.replace(/\/current\/?.*/, '');

                this.findNode(req, libUrl, function (result) {
                    if (!result || !result.items) return;

                    var versions = result.items.map(function (item) {
                        return item.url.substr(item.url.lastIndexOf('/'));
                    });

                    if (versions) {
                        url = url.replace(/\/current\//, '/' + versions[0] + '/');
                        res.redirect(301, url);
                        return;
                    }
                });
            }

            return url;
        },

        /**
         * Callback function after find node
         * @param result - {BaseNode} node that was found
         * @param res - {Object} response object
         * @returns {boolean}
         */
        afterFindNode: function(result, req, res) {
            if(result.lib && result.items && result.items.length) {
                res.redirect(301, result.items[0].url);
                return true;
            }

            if((result.VIEW.POSTS === result.view) && result.items && result.items.length) {
                res.redirect(301, result.items.filter(function(item) { return !item.hidden[req.lang]; })[0].url);
                return true;
            }

            if((result.TYPE.GROUP === result.type) && result.items && result.items.length) {
                res.redirect(301, result.items.filter(function(item) { return !item.hidden[req.lang]; })[0].url);
                return true;
            }

            return false;
        }
    });
});
