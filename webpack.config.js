const path = require('path')

const config = {
    mode: 'production',
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.min.js',
    },
    devServer: {
        contentBase: path.resolve(__dirname, 'demo'),
        publicPath: '/dist',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
        ],
    },
}

module.exports = config