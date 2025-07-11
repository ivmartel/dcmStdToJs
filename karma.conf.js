import {webpackTest} from './config/webpack.test.js';

// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

export default function (config) {
  config.set({
    basePath: '.',
    frameworks: ['qunit', 'webpack'],
    plugins: [
      'karma-qunit',
      'karma-chrome-launcher',
      'karma-coverage',
      'karma-webpack',
      'karma-sourcemap-loader'
    ],
    files: [
      {pattern: './tests/**/*.test.js', watched: false}
    ],
    client: {
      clearContext: false,
      qunit: {
        showUI: true,
        testTimeout: 5000
      }
    },
    preprocessors: {
      'src/**/*.js': ['webpack', 'sourcemap'],
      'tests/**/*.test.js': ['webpack']
    },
    coverageReporter: {
      dir: './build/coverage',
      reporters: [
        {type: 'html', subdir: 'report-html'},
        {type: 'text-summary'}
      ]
    },
    reporters: ['progress'],
    logLevel: config.LOG_INFO,
    browsers: ['Chrome'],
    restartOnFileChange: true,
    webpack: webpackTest
  });
};
