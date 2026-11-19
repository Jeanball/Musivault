import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'logs', 'uploads'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      // 45 existing uses of `any`: reported, not blocking, until they are typed one file at a time.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `const { addedAt, ...rest } = x` to drop a field is fine.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
)
