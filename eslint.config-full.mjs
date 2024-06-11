import eslintConfig from './eslint.config.mjs';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  ...eslintConfig,
  jsdoc.configs['flat/recommended'],
  {
    plugins: {
      jsdoc
    },
    rules: {
      // tag lines
      // https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/tag-lines.md#readme
      'jsdoc/tag-lines': ['error', 'any', {'startLines': 1}]
    }
  }
];
