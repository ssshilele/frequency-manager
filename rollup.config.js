import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import eslint from '@rollup/plugin-eslint';

const isProd = process.env.ENV === 'production';

export default {
  input: 'src/index.js',
  output: {
    file: 'lib/index.js',
    format: 'umd',
    name: 'FrequencyManager',
    exports: 'named',
    sourcemap: !isProd,
  },
  plugins: [resolve(), commonjs(), eslint()].concat(
    isProd
      ? [
          babel({
            exclude: 'node_modules/**',
            runtimeHelpers: true,
          }),
          terser(),
        ]
      : []
  ),
};
