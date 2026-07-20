import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const common = {
  entry: {
    dcmstdtojs: './src/index.js',
  },
  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, '../dist'),
    library: {
      type: 'module'
    },
    clean: true,
  },
  experiments: {
    // module is still experimental
    outputModule: true
  },
};