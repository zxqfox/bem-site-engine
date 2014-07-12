module.exports = {
    get: function() {
        return [
            getMain(),
            getDocs()
        ]
    }
};

var getMain = function() {
    return {
        title: 'Привет Bem-Engine',
        route: {
            name: 'index',
            pattern: '/'
        },
        source: {
            ru: {
                title: 'Bem-site-engine',
                createDate: '12-07-2014',
                authors: [],
                tags: [],
                content: 'https://github.com/bem/bem-site-engine/blob/BEMINFO-379/README.md'
            }
        }
    };
};

var getDocs = function() {
    return {
        title: 'Документация',
        route: {
            name: 'docs',
            pattern: '/docs'
        },
        items: [
            {
                title: 'Создание модели',
                route: 'model',
                source: {
                    ru: {
                        title: 'Создание модели',
                        createDate: '12-07-2014',
                        authors: [],
                        tags: [],
                        content: 'https://github.com/bem/bem-site-engine/blob/BEMINFO-379/docs/model.ru.md'
                    }
                }
            },
            {
                title: 'Конфигурация',
                route: 'config',
                source: {
                    ru: {
                        title: 'Конфигурация',
                        createDate: '12-07-2014',
                        authors: [],
                        tags: [],
                        content: 'https://github.com/bem/bem-site-engine/blob/BEMINFO-379/docs/config.ru.md'
                    }
                }
            },
            {
                title: 'Описание middleware модулей',
                route: 'middleware',
                source: {
                    ru: {
                        title: 'Описание middleware модулей',
                        createDate: '12-07-2014',
                        authors: [],
                        tags: [],
                        content: 'https://github.com/bem/bem-site-engine/blob/BEMINFO-379/docs/middleware.ru.md'
                    }
                }
            },
            {
                title: 'Процесс сборки данных',
                route: 'compile',
                source: {
                    ru: {
                        title: 'Процесс сборки данных',
                        createDate: '12-07-2014',
                        authors: [],
                        tags: [],
                        content: 'https://github.com/bem/bem-site-engine/blob/BEMINFO-379/docs/data_compiling.ru.md'
                    }
                }
            }
        ]
    };
};
