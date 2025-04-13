module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@vizora/common/services/contentService',
            message: 'Use root-level @vizora/common import instead.',
          },
          {
            name: '../../common',
            message: 'Use @vizora/common alias import only.',
          }
        ],
        patterns: ['@vizora/common/services/*'],
      },
    ],
  },
}; 