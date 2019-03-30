// node-resolve will resolve all the node dependencies
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';

export default {
    input: 'src/ReactAnimationOrchestrator.js',
    output: {
        file: 'dist/ReactAnimationOrchestrator.js',
        format: 'es'
    },
    // All the used libs needs to be here
    external: [
        'react',
        'react-proptypes',
        'gsap'
    ],
    plugins: [
        resolve(),
        babel({
            exclude: 'node_modules/**'
        }),
        commonjs()
    ]
}