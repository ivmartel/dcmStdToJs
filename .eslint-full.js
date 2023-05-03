module.exports = {
  plugins: [
    'jsdoc'
  ],
  extends: [
    '.eslintrc.js',
    'plugin:jsdoc/recommended',
  ],
  rules: {
    // tag lines
    // https://github.com/gajus/eslint-plugin-jsdoc#eslint-plugin-jsdoc-rules-tag-lines
    'jsdoc/tag-lines': ['error', 'any', {'startLines': 1}]
  }
};
