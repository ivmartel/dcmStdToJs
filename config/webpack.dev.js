import {merge} from 'webpack-merge';
import HtmlWebpackPlugin from 'html-webpack-plugin';

import {common} from './webpack.common.js';

export default merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: [
      {
        directory: './resources',
        publicPath: '/resources'
      },
    ],
  },
  entry: {
    dev: './dev/index.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dev/index.html',
      scriptLoading: 'module',
      chunks: ['dev']
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
});