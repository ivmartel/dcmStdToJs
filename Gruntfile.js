module.exports = function (grunt) {
  // karma ci test coverage
  let karmaCiReporters = ['progress'];
  if (grunt.option('coverage')) {
    karmaCiReporters.push('coverage');
  }
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    eslint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'tests/**/*.js']
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        client: {
          qunit: {
            filter: grunt.option('filter')
          }
        }
      },
      ci: {
        configFile: 'karma.conf.js',
        browsers: ['ChromeHeadless'],
        reporters: karmaCiReporters,
        singleRun: true
      }
    },
    watch: {
      main: {
        files: ['**/*.js', '!**/node_modules/**'],
        tasks: ['eslint'],
        options: {
          spawn: false,
          livereload: true
        }
      },
    },
    connect: {
      server: {
        options: {
          port: 8080,
          hostname: 'localhost',
          livereload: true
        }
      }
    },
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-karma');

  // tasks
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('start', ['connect', 'watch']);
  grunt.registerTask('test', ['karma:unit']);
  grunt.registerTask('test-ci', ['karma:ci']);
};