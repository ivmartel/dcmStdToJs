import path from 'path';
import {fileURLToPath} from 'url';
import {merge} from 'webpack-merge';
import CopyPlugin from 'copy-webpack-plugin';

import {common} from './webpack.common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default merge(common, {
  mode: 'production',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../assets/**/*.json'),
          to: 'assets/[path][name][ext]',
          context: path.resolve(__dirname, '../assets'),
          transform(content) {
            return JSON.stringify(JSON.parse(content.toString()));
          }
        }
      ]
    })
  ]
});