const path = require('path');

module.exports = {
    devtool: 'eval-cheap-module-source-map',
    // モードの設定、v4系以降はmodeを指定しないと、webpack実行時に警告が出る
    mode: 'development',
    // エントリーポイントの設定
    entry: './src/index.js',
    // 出力の設定
    output: {
        filename: 'bundle.js',
        path: path.join(__dirname, 'public/js')
    }
};
