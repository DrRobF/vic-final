export default {
 serverExternalPackages:['pdf-parse','pdfjs-dist','@napi-rs/canvas','mammoth'],
 outputFileTracingIncludes:{'/api/lessonplan/import':['./node_modules/pdf-parse/**/*','./node_modules/pdfjs-dist/**/*','./node_modules/@napi-rs/canvas*/**/*']}
}
