# Build system integrations

*svg-sprite* provides a CLI and a Node.js API rather than framework-specific plugins. Run the CLI as part of your build to generate sprite files before the build system processes or serves static assets.

## Shared setup

Create a configuration file such as `svg-sprite.config.json`:

```json
{
  "dest": "public",
  "mode": {
    "symbol": true
  }
}
```

Add a script to `package.json` that points at your SVG sources:

```json
{
  "scripts": {
    "sprites": "svg-sprite --config svg-sprite.config.json \"src/icons/**/*.svg\""
  }
}
```

The CLI writes the generated files under `public`. Adjust `dest`, the enabled output modes, and the input glob to match your project.

## Vite

Vite serves files in `public` from the site root during development and copies them to the build output for production. Add lifecycle scripts so sprites are generated before the dev server and production build:

```json
{
  "scripts": {
    "dev": "vite",
    "predev": "npm run sprites",
    "build": "vite build",
    "prebuild": "npm run sprites"
  }
}
```

For example, a generated sprite at `public/symbol/sprite.symbol.svg` is available at `/symbol/sprite.symbol.svg`.

## Webpack

Generate sprites before starting the dev server or running a production build in the same way:

```json
{
  "scripts": {
    "start": "webpack serve",
    "prestart": "npm run sprites",
    "build": "webpack",
    "prebuild": "npm run sprites"
  }
}
```

Configure Webpack's static-file serving and output to include the generated files. For example, projects using `copy-webpack-plugin` can copy `public` into the output directory:

```js
import CopyPlugin from 'copy-webpack-plugin';

export default {
  plugins: [
    new CopyPlugin({
      patterns: [{ from: 'public', to: '.' }]
    })
  ]
};
```

Use the generated sprite URL in your application according to the static asset paths configured for your project.
