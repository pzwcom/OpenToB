import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rspack } from '@rspack/core'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default (env, argv) => {
  const isDev = argv?.mode !== 'production'

  return {
    mode: argv?.mode || 'development',
    context: __dirname,
    entry: { main: './src/main.jsx' },
    output: {
      path: resolve(__dirname, 'dist'),
      filename: isDev ? 'assets/[name].js' : 'assets/[name].[contenthash:8].js',
      chunkFilename: isDev ? 'assets/[name].js' : 'assets/[name].[contenthash:8].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
    },
    devtool: isDev ? 'eval-source-map' : false,
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: [/node_modules/],
          type: 'javascript/auto',
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  parser: { syntax: 'ecmascript', jsx: true },
                  transform: {
                    react: { runtime: 'automatic', development: isDev },
                  },
                },
              },
            },
          ],
        },
        {
          test: /\.less$/,
          type: 'javascript/auto',
          use: ['style-loader', 'css-loader', 'less-loader'],
        },
        {
          test: /\.css$/,
          type: 'javascript/auto',
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: resolve(__dirname, 'index.html'),
        title: 'TOB Frontend',
      }),
      new rspack.CopyRspackPlugin({
        patterns: [{ from: resolve(__dirname, 'public'), to: resolve(__dirname, 'dist') }],
      }),
    ],
    devServer: {
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true,
      proxy: [
        { context: ['/api'], target: 'http://localhost:8080', changeOrigin: true },
      ],
    },
  }
}
