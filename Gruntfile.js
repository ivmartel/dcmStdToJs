module.exports = function (grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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

  // tasks
  grunt.registerTask('start', ['connect', 'watch']);
};
