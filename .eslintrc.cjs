module.exports = {
    root: true,
    env: {
        node: true,
    },
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint/eslint-plugin'],
    ignorePatterns: ['dist', '.eslintrc.cjs', 'webpack.config.js'],
};