import { communication } from './declarations'

function main() {
  return communication.net.http.get('http://site.test/index.html')
}

main()
