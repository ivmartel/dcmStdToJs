import path from 'path';
import {fileURLToPath} from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    index: './dev/index.js',
  },
  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, '../build/demo'),
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dev/index.html',
      scriptLoading: 'module',
      chunks: ['index']
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
};