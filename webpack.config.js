const config = {
    mode: 'production',
    entry: './src/index.js',
    output: {
        path: __dirname + '/dist',
        filename: 'bt.min.js',
    },
    devServer: {
        contentBase: __dirname + '/src',
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