/**
 * P1 修复 #14：后端 ESLint 配置
 * 配合 tsconfig.json 第一阶段 strict 子集，逐步收紧代码质量
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: ['./tsconfig.json'],
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'prisma/migrations/',
    'scripts/',
    'load-tests/',
    'tests/',
    '*.js',
    '*.cjs',
  ],
  rules: {
    // P1 修复 #13/#14：no-explicit-any 先 warn，待 tsconfig.strict.json 全量修复后升级为 error
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    // 需要类型信息的规则（依赖 project 配置）保持 off，避免性能问题
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-floating-promises': 'off',

    // 通用规则
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
    'no-var': 'error',
    'prefer-const': 'warn',
    'object-shorthand': 'warn',
    'quote-props': ['error', 'as-needed'],
    // Formatting is checked separately; keeping it out of ESLint prevents legacy
    // line-ending differences from obscuring actionable semantic diagnostics.
    'prettier/prettier': 'off',
  },
};
