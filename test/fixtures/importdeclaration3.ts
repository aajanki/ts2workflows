import { communication } from './declarations.js'

function main() {
  return communication.net.http.get('http://site.test/index.html')
}

main()
