// File: plugins/svg-to-vue/svgo.config.js

export default {
  multipass: true,
  plugins: [
    // Safe plugins uniquement
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeDesc',
    'removeTitle',
    'sortAttrs',
    'removeDimensions'
  ]
}
