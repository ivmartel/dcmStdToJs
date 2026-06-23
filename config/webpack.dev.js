import {merge} from 'webpack-merge';

import {common} from './webpack.common.js';

export default merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist'
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          // babel loader with istanbul
          loader: 'babel-loader',
          options: {
            plugins: ['istanbul']
          }
        }
      }
    ]
  }
});